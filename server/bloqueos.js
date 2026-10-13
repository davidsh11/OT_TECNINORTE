const crypto = require('node:crypto');
const upper = (v) => String(v || '').trim().toUpperCase();
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, max = 600) {
  if (value !== undefined && typeof value !== 'string') fail(400, 'Texto no valido');
  const result = (value || '').trim();
  if (result.length > max) fail(400, `El texto supera ${max} caracteres`);
  return result;
}
function required(value, label) { const result = text(value); if (!result) fail(400, `${label} es obligatorio`); return result; }
function date(value, withTime = false) {
  const result = text(value, 40);
  if (!result) return '';
  if (!/^\d{4}-\d{2}-\d{2}/.test(result) || !Number.isFinite(Date.parse(result)) || (!withTime && !/^\d{4}-\d{2}-\d{2}$/.test(result))) fail(400, 'Fecha no valida');
  if (!withTime && new Date(result).toISOString().slice(0, 10) !== result) fail(400, 'Fecha no valida');
  return result;
}
function areaMechanic(ot, area) {
  if (area === 'mecanica') return upper(ot.MecanicoResponsable || ot.MecanicoAsignadoNombre || ot.MecanicoAsignado);
  if (area === 'alineacion_balanceo' && ot.RequiereAlineacionBalanceo) return upper(ot.MecanicoAlineacionBalanceo || 'FERNANDOS');
  if (area === 'cambio_aceite' && ot.RequiereCambioAceite) return upper(ot.MecanicoCambioAceite || 'JOSELOS');
  return '';
}
function canRegister(user, ot, area) {
  const mechanic = areaMechanic(ot, area);
  return Boolean(mechanic && (user.role === 'admin' || (user.role === 'mecanico' && upper(user.mechanicId || user.name) === mechanic)));
}
function canRead(user, ot) {
  if (['admin', 'cobranza', 'jefe_taller'].includes(user.role)) return true;
  return ['mecanica', 'alineacion_balanceo', 'cambio_aceite'].some((area) => canRegister(user, ot, area));
}
function workOptions(ot, details, user) {
  const result = [];
  if (canRegister(user, ot, 'mecanica')) {
    result.push({ id: 'general:mecanica', area: 'mecanica', label: 'Trabajo de mecanica (especifique el detalle)', requiresDetail: true });
    for (const item of details) if (upper(item.Tipo) === 'TRABAJO' && String(item.Descripcion || '').trim()) {
      result.push({ id: `detalle:${item.ID}`, area: 'mecanica', label: String(item.Descripcion), requiresDetail: false });
    }
  }
  for (const [area, value, label] of [
    ['alineacion_balanceo', ot.ObservacionAlineacionBalanceo, 'Alineacion y balanceo'],
    ['cambio_aceite', ot.AceiteSolicitado, 'Cambio de aceite']
  ]) if (canRegister(user, ot, area)) result.push({ id: `area:${area}`, area, label: value ? `${label}: ${value}` : label, requiresDetail: !value });
  return result;
}
function activeBlocks(ot) { return Array.isArray(ot.BloqueosActivos) ? ot.BloqueosActivos : []; }
function blockCounts(orders) {
  const all = new Set(), parts = new Set(), auth = new Set();
  for (const ot of orders) for (const b of activeBlocks(ot)) {
    all.add(ot.ID);
    if (b.motivo === 'repuestos') parts.add(ot.ID);
    if (b.motivo === 'autorizacion') auth.add(ot.ID);
  }
  return { bloqueadas: all.size, esperandoRepuestos: parts.size, esperandoAutorizacion: auth.size };
}
function summary(b) {
  const { id, area, trabajoId, trabajo, motivo, detalle, mecanico, creadoEn, estado, responsable, proximaAccion, llegadaEstimada, respuesta } = b;
  return { id, area, trabajoId, trabajo, motivo, detalle, mecanico, creadoEn, estado, responsable, proximaAccion, llegadaEstimada, respuesta };
}
function makeBlocks(user, ot, works, body, now, ids) {
  const automatic = !body.trabajoId;
  const area = body.area || works[0]?.area;
  const work = automatic
    ? (works.some((w) => w.area === area) ? { id: 'general:' + area, area, label: 'Bloqueo de OT' } : null)
    : works.find((w) => w.id === body.trabajoId);
  if (!work || !canRegister(user, ot, work.area)) fail(403, 'Solo puede registrar bloqueos en sus trabajos asignados');
  if (ot.SalidaAutorizada || ot.Cobrado) fail(409, 'La OT ya esta cerrada para registrar bloqueos');
  if (!['repuestos', 'autorizacion', 'ambos'].includes(body.motivo)) fail(400, 'Seleccione un motivo valido');
  const detail = text(body.detalle);
  const reasons = body.motivo === 'ambos' ? ['repuestos', 'autorizacion'] : [body.motivo];
  if (!automatic && ((!detail && work.requiresDetail) || (!detail && reasons.includes('repuestos')))) fail(400, 'Describa que repuesto falta o que trabajo necesita autorizacion');
  if (reasons.some((motivo) => activeBlocks(ot).some((b) => b.motivo === motivo && (b.trabajoId === work.id || (b.area === work.area && (automatic || b.trabajoId === 'general:' + work.area)))))) fail(409, 'Ya existe un bloqueo activo para este trabajo y motivo. Consulte su seguimiento');
  return reasons.map((motivo, i) => ({
    id: ids[i], otId: ot.ID, area: work.area, trabajoId: work.id, trabajo: work.label,
    motivo, detalle: detail || (automatic ? (motivo === 'repuestos' ? 'Falta de repuestos' : 'Falta de autorizacion del cliente') : work.label), mecanico: areaMechanic(ot, work.area),
    creadoEn: now, actualizadoEn: now, creadoPor: user.username, version: 1, activo: true,
    estado: motivo === 'repuestos' ? 'por_gestionar' : 'pendiente', respuesta: motivo === 'autorizacion' ? 'pendiente' : '',
    responsable: 'Cobranza', proximaAccion: motivo === 'repuestos' ? 'Solicitar repuesto y confirmar proveedor' : 'Contactar al cliente para solicitar autorizacion',
    repuesto: motivo === 'repuestos' ? detail : '', proveedor: '', llegadaEstimada: '',
    trabajoAutorizar: motivo === 'autorizacion' && !automatic ? work.label : '', fechaContacto: '', observaciones: '',
    resolucion: '', resueltoEn: '', resueltoPor: ''
  }));
}
function manageBlock(user, current, body, now) {
  if (!['admin', 'cobranza'].includes(user.role)) fail(403, 'Solo Cobranza o administrador pueden gestionar bloqueos');
  if (!current.activo) fail(409, 'Este bloqueo ya fue resuelto');
  if (body.version !== current.version) fail(409, 'Otro usuario actualizo el bloqueo. Actualice antes de guardar');
  const next = { ...current, responsable: required(body.responsable, 'Responsable'), proximaAccion: required(body.proximaAccion, 'Proxima accion'), observaciones: text(body.observaciones), actualizadoEn: now, version: current.version + 1 };
  if (current.motivo === 'repuestos') {
    if (!['por_gestionar', 'pedido', 'disponible'].includes(body.estado)) fail(400, 'Estado de repuesto no valido');
    next.estado = body.estado;
    next.repuesto = required(body.repuesto, 'Repuesto solicitado');
    next.proveedor = text(body.proveedor);
    next.llegadaEstimada = date(body.llegadaEstimada);
    if (body.estado === 'pedido' && !next.proveedor) fail(400, 'Indique el proveedor del pedido');
    next.activo = body.estado !== 'disponible';
    if (!next.activo) next.resolucion = 'Repuesto disponible';
  } else {
    if (!['pendiente', 'aprobado', 'rechazado'].includes(body.respuesta)) fail(400, 'Respuesta de autorizacion no valida');
    next.trabajoAutorizar = required(body.trabajoAutorizar, 'Trabajo que necesita aprobacion');
    next.fechaContacto = date(body.fechaContacto, true);
    next.respuesta = body.respuesta;
    next.estado = body.respuesta;
    if (next.respuesta !== 'pendiente' && !next.fechaContacto) fail(400, 'Indique la fecha de contacto con el cliente');
    next.activo = next.respuesta !== 'aprobado';
    if (!next.activo) next.resolucion = 'Cliente aprobo el trabajo';
    if (body.descartarTrabajo === true) {
      if (current.respuesta !== 'rechazado' || next.respuesta !== 'rechazado') fail(400, 'Primero registre el rechazo del cliente');
      next.resolucion = required(body.resolucion, 'Decision explicita sobre el trabajo rechazado');
      next.estado = 'cerrado_sin_ejecutar';
      next.activo = false;
    }
  }
  if (!next.activo) { next.resueltoEn = now; next.resueltoPor = user.username; }
  return next;
}

function registerBlockRoutes(app, { getFirebase, OT_COLLECTION, requireSession, getSystemUser, publicSystemUser }) {
  const collection = `${OT_COLLECTION}_bloqueos`;
  const secured = (handler) => [requireSession, async (req, res) => {
    try {
      const { db } = getFirebase();
      const stored = await getSystemUser(db, req.sessionUser.username);
      if (!stored || stored.active === false) fail(403, 'Usuario inactivo o no registrado');
      const user = publicSystemUser(stored);
      await handler(req, res, db, user);
    } catch (e) {
      if (!e.status) console.error('Bloqueos OT:', e);
      res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'No se pudo guardar o consultar el bloqueo' });
    }
  }];
  const otData = (snapshot) => { if (!snapshot.exists) fail(404, 'OT no encontrada'); return { ...snapshot.data(), ID: snapshot.id }; };
  const event = (user, before, after, now) => ({ usuario: user.username, nombre: user.name || user.username, rol: user.role, fecha: now, accion: !before ? 'registro' : after.activo ? 'gestion' : 'resolucion', antes: before, despues: after });

  app.get('/api/bloqueos', ...secured(async (req, res, db, user) => {
    if (!['admin', 'cobranza'].includes(user.role)) fail(403, 'Acceso exclusivo de Cobranza o administrador');
    const query = req.query.historial === 'true' ? db.collection(collection) : db.collection(collection).where('activo', '==', true);
    const snapshot = await query.get();
    const blocks = snapshot.docs.map((doc) => doc.data());
    const ids = [...new Set(blocks.map((b) => b.otId))];
    const orders = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const docs = await db.getAll(...ids.slice(i, i + 100).map((id) => db.collection(OT_COLLECTION).doc(id)));
      docs.forEach((doc) => { if (doc.exists) orders.set(doc.id, doc.data()); });
    }
    res.json({ ok: true, bloqueos: blocks.map((b) => {
      const ot = orders.get(b.otId) || {};
      return { ...b, placa: ot.Placa || '', vehiculo: [ot.Marca, ot.Modelo].filter(Boolean).join(' '), cliente: ot.Propietario || '', otEliminada: !orders.has(b.otId) };
    }).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)) });
  }));
  app.get('/api/ot/:id/bloqueos', ...secured(async (req, res, db, user) => {
    const ref = db.collection(OT_COLLECTION).doc(req.params.id);
    const ot = otData(await ref.get());
    if (!canRead(user, ot)) fail(403, 'No tiene acceso a los bloqueos de esta OT');
    const snapshot = await db.collection(collection).where('otId', '==', ot.ID).get();
    const payload = { ok: true, registroPorMotivo: true, bloqueos: snapshot.docs.map((doc) => doc.data()).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)) };
    // Polling needs status only, not the original work detail collection.
    if (req.query.updatesOnly !== 'true') {
      const details = await ref.collection('detalle').get();
      payload.trabajos = workOptions(ot, details.docs.map((doc) => ({ ...doc.data(), ID: doc.id })), user);
    }
    res.json(payload);
  }));
  app.get('/api/ot/:id/bloqueos/:blockId/historial', ...secured(async (req, res, db, user) => {
    const otSnapshot = await db.collection(OT_COLLECTION).doc(req.params.id).get();
    if (otSnapshot.exists ? !canRead(user, otSnapshot.data()) : !['admin', 'cobranza'].includes(user.role)) fail(403, 'No tiene acceso a esta OT');
    const ref = db.collection(collection).doc(req.params.blockId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data().otId !== req.params.id) fail(404, 'Bloqueo no encontrado');
    const history = await ref.collection('historial').get();
    res.json({ ok: true, historial: history.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.fecha.localeCompare(b.fecha)) });
  }));
  app.post('/api/ot/:id/bloqueos', ...secured(async (req, res, db, user) => {
    const ref = db.collection(OT_COLLECTION).doc(req.params.id);
    const now = new Date().toISOString();
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const blocks = await db.runTransaction(async (tx) => {
      const ot = otData(await tx.get(ref));
      const details = await tx.get(ref.collection('detalle'));
      const works = workOptions(ot, details.docs.map((doc) => ({ ...doc.data(), ID: doc.id })), user);
      const created = makeBlocks(user, ot, works, req.body || {}, now, ids);
      const active = [...activeBlocks(ot), ...created.map(summary)];
      if (active.length > 100) fail(409, 'Resuelva bloqueos existentes antes de registrar mas');
      for (const block of created) {
        const bRef = db.collection(collection).doc(block.id);
        tx.set(bRef, block);
        tx.set(bRef.collection('historial').doc(crypto.randomUUID()), event(user, null, block, now));
      }
      tx.update(ref, { BloqueosActivos: active, BloqueosVersion: 1 });
      return created;
    });
    res.status(201).json({ ok: true, bloqueos: blocks });
  }));
  app.patch('/api/ot/:id/bloqueos/:blockId', ...secured(async (req, res, db, user) => {
    if (!['admin', 'cobranza'].includes(user.role)) fail(403, 'Solo Cobranza o administrador pueden gestionar bloqueos');
    const ref = db.collection(OT_COLLECTION).doc(req.params.id);
    const bRef = db.collection(collection).doc(req.params.blockId);
    const now = new Date().toISOString();
    const block = await db.runTransaction(async (tx) => {
      const ot = otData(await tx.get(ref));
      const snapshot = await tx.get(bRef);
      if (!snapshot.exists || snapshot.data().otId !== ot.ID) fail(404, 'Bloqueo no encontrado');
      const before = snapshot.data();
      const after = manageBlock(user, before, req.body || {}, now);
      const active = activeBlocks(ot).filter((b) => b.id !== after.id);
      if (after.activo) active.push(summary(after));
      tx.update(bRef, after);
      tx.set(bRef.collection('historial').doc(crypto.randomUUID()), event(user, before, after, now));
      tx.update(ref, { BloqueosActivos: active, BloqueosVersion: 1 });
      return after;
    });
    res.json({ ok: true, bloqueo: block });
  }));
}
module.exports = { registerBlockRoutes, activeBlocks, blockCounts, canRegister, canRead, workOptions, makeBlocks, manageBlock, summary };
