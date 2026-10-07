const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.js'), 'utf8');
function setup({ exists = true, size = 2 } = {}) {
  const routes = {};
  const writes = [];
  const ref = { collection: () => 'details' };
  const db = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (fn) => fn({
      get: async (target) => target === ref ? { exists, data: () => ({}) } : { size, docs: Array.from({ length: size }, (_, i) => ({ ref: i })) },
      delete: (target) => writes.push(['delete', target]),
      update: (target, data) => writes.push(['update', data])
    })
  };
  const catalogName = source.match(/const (\w+) = \[\s*\{ username: "recepcion"/)[1];
  const context = vm.createContext({
    activeBlocks: require("../bloqueos").activeBlocks,
    Buffer, crypto, process: { env: { SESSION_SECRET: 'test-secret' } },
    console: { error() {} }, getFirebase: () => ({ db }), OT_COLLECTION: 'test',
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'timestamp' } } },
    [catalogName]: [{ role: 'mecanico', mechanicId: 'YONG' }],
    app: { delete: (p, ...handlers) => { routes.delete = handlers; }, patch: (p, ...handlers) => { routes.patch = handlers; } }
  });
  vm.runInContext(source.slice(source.indexOf('function sessionSecret()'), source.indexOf('function sentenceText(')), context);
  vm.runInContext(source.slice(source.indexOf('app.delete("/api/ot/:id",'), source.indexOf('app.get("/api/ot/:id",')), context);
  async function request(method, body, role = 'admin') {
    const token = role ? vm.runInContext('createSessionToken({ username: "tester", role: "' + role + '" })', context) : '';
    const req = { headers: { authorization: 'Bearer ' + token }, params: { id: '123' }, body };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    let allowed = false;
    routes[method][0](req, res, () => { allowed = true; });
    if (allowed) await routes[method][1](req, res);
    return res;
  }
  return { request, writes };
}
test('both operations require authenticated admin', async () => {
  for (const method of ['delete', 'patch']) {
    const s = setup();
    assert.equal((await s.request(method, {}, null)).code, 401);
    assert.equal((await s.request(method, {}, 'mecanico')).code, 403);
    assert.equal(s.writes.length, 0);
  }
});
test('delete requires matching confirmation and removes details and parent', async () => {
  const s = setup();
  assert.equal((await s.request('delete', { confirmId: 'wrong' })).code, 400);
  assert.equal(s.writes.length, 0);
  assert.equal((await s.request('delete', { confirmId: '123' })).code, 200);
  assert.equal(s.writes.length, 3);
});
test('missing orders return 404 without writes', async () => {
  const s = setup({ exists: false });
  assert.equal((await s.request('delete', { confirmId: '123' })).code, 404);
  assert.equal((await s.request('patch', { MecanicoResponsable: 'YONG' })).code, 404);
  assert.equal(s.writes.length, 0);
});
test('reassignment validates mechanic and preserves other OT fields', async () => {
  const s = setup();
  assert.equal((await s.request('patch', { MecanicoResponsable: 'INVALID' })).code, 400);
  assert.equal(s.writes.length, 0);
  assert.equal((await s.request('patch', { MecanicoResponsable: ' yong ' })).code, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(s.writes)), [['update', { MecanicoResponsable: 'YONG', ReasignadoPor: 'tester', updatedAt: 'timestamp' }]]);
});
test('oversized deletion refuses without partial writes', async () => {
  const s = setup({ size: 500 });
  assert.equal((await s.request('delete', { confirmId: '123' })).code, 409);
  assert.equal(s.writes.length, 0);
});
