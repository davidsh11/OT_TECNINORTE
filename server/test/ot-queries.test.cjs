const { test } = require('node:test');
const assert = require('node:assert/strict');
const doc = (id, data) => ({ id, data: () => ({ ...data }) });
test('Mis OT queries Firebase on every request and sees assignments changed by another device',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');const source=fs.readFileSync(require('node:path').join(__dirname,'../index.js'),'utf8');
 let directReads=0,fullReads=0,handler;
 const docs=[doc('1',{ID:'1',MecanicoResponsable:'YONG',FechaRecepcion:'2026-10-01T10:00:00Z'}),doc('2',{ID:'2',MecanicoResponsable:'ANGELF',FechaRecepcion:'2026-10-02T10:00:00Z'})];
 const collection=()=>({orderBy(){return this;},limit(){return this;},where(filter){this.filter=filter;return this;},async get(){if(this.filter){directReads++;return {docs:docs.filter(d=>this.filter.some(f=>d.data()[f.field]===f.value))};}fullReads++;return {docs};}});
 const context=vm.createContext({console,getFirebase:()=>({db:{collection}}),OT_COLLECTION:'OT',admin:{firestore:{Filter:{where:(field,op,value)=>({field,value}),or:(...args)=>args}}},app:{get:(_p,fn)=>{handler=fn;}}});
 vm.runInContext(source.slice(source.indexOf('function normalizeText('),source.indexOf('const PRE_COMPRA_REPORT_SECTIONS')),context);
 const start=source.indexOf('app.get("/api/ot",');vm.runInContext(source.slice(start,source.indexOf('\napp.',start+1)),context);
 const request=async()=>{const res={code:200,status(c){this.code=c;return this;},json(data){this.data=data;}};await handler({query:{assignedTo:'YONG'}},res);assert.equal(res.code,200);return res.data;};
 assert.equal((await request()).ordenes.length,1);
 await request();assert.equal(directReads,2);assert.equal(fullReads,0);
 docs[1]=doc('2',{ID:'2',MecanicoResponsable:'YONG',FechaRecepcion:'2026-10-02T10:00:00Z'});
 assert.equal((await request()).ordenes.length,2);
 assert.equal(directReads,3);assert.equal(fullReads,0);
});
