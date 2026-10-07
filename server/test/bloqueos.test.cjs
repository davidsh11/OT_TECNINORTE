const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const crypto = require('node:crypto');
const vm = require('node:vm');
const fs = require('node:fs');
const { registerBlockRoutes, blockCounts, activeBlocks, canRegister } = require('../bloqueos');

function memoryDb() {
  const records = new Map();
  const snap = (ref, data = records.get(ref.path)) => ({ id: ref.id, ref, exists: data !== undefined, data: () => structuredClone(data) });
  const collection = (path, filter) => ({ path,
    doc: (id) => doc(`${path}/${id}`),
    where: (field, op, value) => collection(path, [field, value]),
    get: async () => { const docs = [...records].filter(([key, val]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && (!filter || val[filter[0]] === filter[1])).map(([key, val]) => snap(doc(key), val)); return { docs, size: docs.length }; }
  });
  const doc = (path) => ({ path, id: path.split('/').at(-1), collection: (name) => collection(`${path}/${name}`), get: async () => snap(doc(path)) });
  let queue = Promise.resolve();
  return { records, collection, getAll: (...refs) => Promise.all(refs.map((r) => r.get())), runTransaction(fn) {
    const run = queue.then(async () => {
      const writes = [];
      const result = await fn({ get: (ref) => ref.get(), set: (ref, value) => writes.push([ref.path, value]), update: (ref, value) => writes.push([ref.path, { ...records.get(ref.path), ...value }]) });
      writes.forEach(([key, val]) => records.set(key, structuredClone(val)));
      return result;
    }); queue = run.catch(() => {}); return run;
  } };
}
const users = {
  yong: { username: 'yong', name: 'YONG', mechanicId: 'YONG', role: 'mecanico', active: true },
  joselos: { username: 'joselos', name: 'JOSELOS', mechanicId: 'JOSELOS', role: 'mecanico', active: true },
  fernandos: { username: 'fernandos', name: 'FERNANDOS', mechanicId: 'FERNANDOS', role: 'mecanico', active: true },
  cobranza: { username: 'cobranza', name: 'Cobranza', role: 'cobranza', active: true },
  admin: { username: 'admin', name: 'Admin', role: 'admin', active: true },
  recepcion: { username: 'recepcion', role: 'recepcion', active: true },
  inactive: { username: 'inactive', mechanicId: 'YONG', role: 'mecanico', active: false }
};
async function setup(t) {
  const db = memoryDb();
  db.records.set('OT/1', { ID: '1', MecanicoResponsable: 'YONG', Estado: 'REALIZANDO', Placa: 'ABC123', Propietario: 'Cliente', RequiereCambioAceite: true, RequiereAlineacionBalanceo: true });
  db.records.set('OT/1/detalle/w1', { Tipo: 'TRABAJO', Descripcion: 'Cambiar bomba de agua' });
  const app = express(); app.use(express.json());
  const source = fs.readFileSync(require('node:path').join(__dirname, '../index.js'), 'utf8');
  const context = vm.createContext({ crypto, Buffer, process: { env: { SESSION_SECRET: 'test' } }, activeBlocks });
  vm.runInContext(source.slice(source.indexOf('function sessionSecret()'), source.indexOf('function normalizeText(')), context);
  vm.runInContext(source.slice(source.indexOf('async function updateOtWithBlockCheck('), source.indexOf('app.patch("/api/ot/:id/cobro",')), context);
  registerBlockRoutes(app, { getFirebase: () => ({ db }), OT_COLLECTION: 'OT', requireSession: context.requireSession, getSystemUser: async (_db, name) => users[name], publicSystemUser: (u) => u });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const call = async (method, path, user = 'yong', body, badToken = false) => {
    const token = user ? context.createSessionToken({ ...users[user], role: 'admin' }) : '';
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${badToken ? token + 'bad' : token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
  };
  const create = (body = {}, user = 'yong') => call('POST', '/api/ot/1/bloqueos', user, { trabajoId: 'detalle:w1', motivo: 'ambos', detalle: 'Falta bomba y aprobacion del cambio', ...body });
  return { db, call, create, guardedUpdate: (changes, areas) => context.updateOtWithBlockCheck(db, db.collection('OT').doc('1'), changes, areas) };
}
test('register both independently, preserve work and mechanic, queue and audit', async (t) => {
  const s = await setup(t); const r = await s.create(); assert.equal(r.status, 201);
  assert.equal(r.data.bloqueos.length, 2);
  const ot = s.db.records.get('OT/1'); assert.equal(ot.Estado, 'REALIZANDO'); assert.equal(ot.MecanicoResponsable, 'YONG');
  assert.deepEqual(blockCounts([ot, ot]), { bloqueadas: 1, esperandoRepuestos: 1, esperandoAutorizacion: 1 });
  const queue = await s.call('GET', '/api/bloqueos', 'cobranza'); assert.equal(queue.data.bloqueos[0].placa, 'ABC123');
  const history = await s.call('GET', `/api/ot/1/bloqueos/${r.data.bloqueos[0].id}/historial`);
  assert.equal(history.data.historial[0].usuario, 'yong'); assert.equal(history.data.historial[0].accion, 'registro');
});
test('parts resolution keeps authorization; rejection requires explicit decision, never approval', async (t) => {
  const s = await setup(t); const created = await s.create(); const [parts, auth] = created.data.bloqueos;
  const patch = (b, values) => s.call('PATCH', `/api/ot/1/bloqueos/${b.id}`, 'cobranza', { ...b, ...values });
  assert.equal((await patch(parts, { estado: 'disponible' })).status, 200);
  assert.deepEqual(blockCounts([s.db.records.get('OT/1')]), { bloqueadas: 1, esperandoRepuestos: 0, esperandoAutorizacion: 1 });
  let rejection = await patch(auth, { respuesta: 'rechazado', fechaContacto: '2026-10-06T10:30', observaciones: 'Cliente no acepta' });
  assert.equal(rejection.data.bloqueo.activo, true);
  await assert.rejects(s.guardedUpdate({ Estado: 'FINALIZADO' }, ['mecanica']), { status: 409 });
  await s.guardedUpdate({ EstadoCambioAceite: 'FINALIZADO' }, ['cambio_aceite']);
  const block = rejection.data.bloqueo;
  assert.equal((await patch(block, { descartarTrabajo: true, resolucion: '' })).status, 400);
  const closed = await patch(block, { descartarTrabajo: true, resolucion: 'Se retira del alcance por decision del cliente' });
  assert.equal(closed.data.bloqueo.activo, false); assert.equal(closed.data.bloqueo.respuesta, 'rechazado'); assert.equal(closed.data.bloqueo.estado, 'cerrado_sin_ejecutar');
  assert.equal(blockCounts([s.db.records.get('OT/1')]).bloqueadas, 0);
  assert.equal((await s.call('GET', '/api/bloqueos', 'cobranza')).data.bloqueos.length, 0);
  assert.equal((await s.call('GET', '/api/bloqueos?historial=true', 'cobranza')).data.bloqueos.length, 2);
});
test('approval resolves only authorization and closed records reject further edits', async (t) => {
  const s=await setup(t); const [parts, auth]=(await s.create()).data.bloqueos;
  const r=await s.call('PATCH', `/api/ot/1/bloqueos/${auth.id}`, 'cobranza', { ...auth, respuesta:'aprobado', fechaContacto:'2026-10-06T11:00' });
  assert.equal(r.data.bloqueo.activo,false);
  assert.deepEqual(blockCounts([s.db.records.get('OT/1')]),{bloqueadas:1,esperandoRepuestos:1,esperandoAutorizacion:0});
  assert.equal((await s.call('PATCH', `/api/ot/1/bloqueos/${auth.id}`, 'cobranza', { ...r.data.bloqueo })).status,409);
  assert.equal(parts.activo,true);
});
test('permissions use signed identity and current role, not forged role or mechanic', async(t)=>{
  const s=await setup(t);
  for(const user of [null,'recepcion','inactive','cobranza']) assert([401,403].includes((await s.create({},user)).status));
  assert.equal((await s.call('POST','/api/ot/1/bloqueos','yong',{},true)).status,401);
  assert.equal((await s.create({mecanico:'YONG'},'joselos')).status,403);
  const b=(await s.create()).data.bloqueos[0];
  assert.equal((await s.call('PATCH',`/api/ot/1/bloqueos/${b.id}`,'yong',{...b,estado:'disponible',userRole:'admin'})).status,403);
  assert.equal((await s.call('GET','/api/bloqueos','yong')).status,403);
  assert.equal((await s.call('GET','/api/ot/1/bloqueos','recepcion')).status,403);
  assert.equal((await s.create({trabajoId:'area:cambio_aceite',motivo:'repuestos'},'joselos')).status,201);
  assert.equal((await s.create({trabajoId:'area:alineacion_balanceo',motivo:'autorizacion'},'fernandos')).status,201);
  assert.equal((await s.call('GET','/api/ot/1/bloqueos','admin')).status,200);
});
test('required detail, canonical work validation, invalid dates and missing OT', async(t)=>{
  const s=await setup(t);
  assert.equal((await s.create({detalle:''})).status,400);
  assert.equal((await s.create({trabajoId:'general:mecanica',motivo:'autorizacion',detalle:''})).status,400);
  assert.equal((await s.create({trabajoId:'inventado'})).status,403);
  const auth=await s.create({motivo:'autorizacion',detalle:''}); assert.equal(auth.status,201);
  assert.equal(auth.data.bloqueos[0].detalle,'Cambiar bomba de agua');
  const b=(await s.create({motivo:'repuestos'})).data.bloqueos[0];
  const url=`/api/ot/1/bloqueos/${b.id}`;
  assert.equal((await s.call('PATCH',url,'admin',{...b,estado:'pedido',proveedor:''})).status,400);
  assert.equal((await s.call('PATCH',url,'admin',{...b,llegadaEstimada:'2026-02-31'})).status,400);
  assert.equal((await s.call('GET','/api/ot/missing/bloqueos')).status,404);
});
test('concurrent duplicate registration is atomic and both never partially creates', async(t)=>{
  const s=await setup(t);
  const results=await Promise.all([s.create(),s.create()]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal(s.db.records.get('OT/1').BloqueosActivos.length,2);
  assert.equal((await s.create()).status,409);
});
test('version conflict rejects stale manager updates; history captures before and after', async(t)=>{
  const s=await setup(t); const b=(await s.create({motivo:'repuestos'})).data.bloqueos[0];
  const url=`/api/ot/1/bloqueos/${b.id}`;
  const update={...b,estado:'pedido',proveedor:'Proveedor A',llegadaEstimada:'2026-10-08'};
  const r=await s.call('PATCH',url,'cobranza',update);assert.equal(r.status,200);
  assert.equal((await s.call('PATCH',url,'admin',update)).status,409);
  const history=(await s.call('GET',url+'/historial')).data.historial;
  assert.equal(history.length,2);assert.equal(history[1].antes.estado,'por_gestionar');assert.equal(history[1].despues.proveedor,'Proveedor A');assert.equal(history[1].usuario,'cobranza');
});
test('legacy orders have zero blocks and counters deduplicate OT across work areas',()=>{
 assert.deepEqual(blockCounts([{ID:'legacy'}]),{bloqueadas:0,esperandoRepuestos:0,esperandoAutorizacion:0});
 assert.deepEqual(blockCounts([{ID:'a',BloqueosActivos:[{motivo:'repuestos'},{motivo:'repuestos'}]},{ID:'a',BloqueosActivos:[{motivo:'autorizacion'}]},{ID:'b',BloqueosActivos:[{motivo:'autorizacion'}]}]),{bloqueadas:2,esperandoRepuestos:1,esperandoAutorizacion:2});
 assert.equal(canRegister(users.joselos,{MecanicoResponsable:'YONG'},'cambio_aceite'),false);
});
test('Seguimiento route includes older blocks, area rows and unique OT counters', async () => {
  const source=fs.readFileSync(require('node:path').join(__dirname,'../index.js'),'utf8');
  const orders=[{ID:'1',FechaRecepcion:'2020-01-01',MecanicoResponsable:'YONG',RequiereCambioAceite:true,BloqueosActivos:[{motivo:'repuestos'},{motivo:'autorizacion'}]}, {ID:'2',FechaRecepcion:'2026-10-01',MecanicoResponsable:'ANGELF'}];
  let handler;
  const context=vm.createContext({ console, activeBlocks, blockCounts, OT_COLLECTION:'OT',
    getFirebase:()=>({db:{collection:()=>({orderBy:()=>({get:async()=>({docs:orders.map(o=>({id:o.ID,data:()=>o}))})})})}}),
    app:{get:(_p,fn)=>{handler=fn;}}
  });
  vm.runInContext(source.slice(source.indexOf('function normalizeText('),source.indexOf('const PRE_COMPRA_REPORT_SECTIONS')),context);
  const start=source.indexOf('app.get("/api/ot/seguimiento",');
  vm.runInContext(source.slice(start,source.indexOf('\napp.',start+1)),context);
  const res={code:200,status(c){this.code=c;return this;},json(data){this.data=data;}};
  await handler({query:{}},res);
  assert.equal(res.code,200);assert.equal(res.data.resumen.bloqueadas,1);assert.equal(res.data.resumen.esperandoRepuestos,1);assert.equal(res.data.resumen.esperandoAutorizacion,1);
  assert.equal(res.data.ordenes.filter(o=>o.ID==='1').length,2);
});
test('frontend block filters and waiting time support both reasons and legacy orders', async () => {
  const { matchesBlockFilters, waitTime }=await import('../../web/src/utils/bloqueos.js');
  const ot={EstadoSeguimiento:'realizando',BloqueosActivos:[{motivo:'repuestos'},{motivo:'autorizacion'}]};
  assert(matchesBlockFilters(ot,'bloqueadas','repuestos'));assert(matchesBlockFilters(ot,'bloqueadas','autorizacion'));
  assert(!matchesBlockFilters(ot,'pendiente','todos'));assert(!matchesBlockFilters({},'bloqueadas','todos'));assert(matchesBlockFilters({},'todos','todos'));
  assert.equal(waitTime({creadoEn:'2026-10-01T10:00:00Z',resueltoEn:'2026-10-03T11:00:00Z'}),'2 d\u00edas, 1 h');
});
test('resolved history remains readable after OT deletion, but not by unrelated users', async(t)=>{
 const s=await setup(t);const b=(await s.create({motivo:'repuestos'})).data.bloqueos[0];const path=`/api/ot/1/bloqueos/${b.id}`;
 await s.call('PATCH',path,'admin',{...b,estado:'disponible'});s.db.records.delete('OT/1');
 assert.equal((await s.call('GET',path+'/historial','admin')).status,200);
 assert.equal((await s.call('GET',path+'/historial','yong')).status,403);
 const history=await s.call('GET','/api/bloqueos?historial=true','cobranza');assert.equal(history.data.bloqueos[0].otEliminada,true);
});
test('frontend distinguishes old backend, expired session and empty successful results', async () => {
  const { blockError } = await import('../../web/src/utils/bloqueos.js');
  assert.match(blockError({ response: { status: 404, data: '<html>Cannot GET</html>' } }), /Reinicie el backend/);
  assert.match(blockError({ response: { status: 401 } }), /vuelva a ingresar/);
  assert.equal(blockError({ response: { status: 403, data: { error: 'No autorizado' } } }), 'No autorizado');
  assert.match(blockError({ request: {} }), /conectar con el servidor/);
});
test('mechanic registers only a reason; area and identity are automatic and protected', async(t)=>{
 const s=await setup(t);
 const r=await s.call('POST','/api/ot/1/bloqueos','yong',{motivo:'ambos'});
 assert.equal(r.status,201);assert.equal(r.data.bloqueos.length,2);
 assert.equal(r.data.bloqueos[0].mecanico,'YONG');assert.equal(r.data.bloqueos[0].area,'mecanica');
 assert.equal(r.data.bloqueos[0].detalle,'Falta de repuestos');
 assert.equal((await s.call('POST','/api/ot/1/bloqueos','yong',{motivo:'repuestos'})).status,409);
 assert.equal((await s.create({motivo:'repuestos'})).status,409);
 assert.equal((await s.call('POST','/api/ot/1/bloqueos','yong',{motivo:'repuestos',area:'cambio_aceite'})).status,403);
 const oil=await s.call('POST','/api/ot/1/bloqueos','joselos',{motivo:'repuestos'});
 assert.equal(oil.status,201);assert.equal(oil.data.bloqueos[0].area,'cambio_aceite');
});
test('reason-only UI supports old running backend using server-approved assigned work', async(t)=>{
 const { blockRegistrationPayload }=await import('../../web/src/utils/bloqueos.js');
 const data={trabajos:[{id:'general:mecanica',area:'mecanica'}]};
 const payload=blockRegistrationPayload(data,'mecanica','autorizacion','Informar si se desmonta la pieza rota');
 assert.equal(payload.trabajoId,'general:mecanica');
 assert.equal(payload.detalle,'Informar si se desmonta la pieza rota');
 const noDetail=blockRegistrationPayload(data,'mecanica','repuestos','');
 assert.equal(noDetail.detalle,'Falta de repuestos');
 assert.throws(()=>blockRegistrationPayload(data,'cambio_aceite','repuestos',''));
 const modern=blockRegistrationPayload({...data,registroPorMotivo:true},'mecanica','repuestos','');
 assert.equal(modern.trabajoId,undefined);assert.equal(modern.detalle,'');
 const s=await setup(t);
 const result=await s.call('POST','/api/ot/1/bloqueos','yong',payload);
 assert.equal(result.status,201);assert.equal(result.data.bloqueos[0].mecanico,'YONG');
});
