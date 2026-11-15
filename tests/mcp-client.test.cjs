const {test} = require('node:test');
const assert = require('node:assert/strict');
const {localUrl, parseRpc, request} = require('../mcp-client.js');
function rpc(id, result, opts = {}) {
  const text = JSON.stringify({jsonrpc:'2.0', id, result});
  return new Response(opts.sse ? 'event: message\r\ndata: '+text+'\r\n\r\n' : text,
    {status:opts.status||200, headers:opts.session ? {'Mcp-Session-Id':opts.session} : {}});
}
const query = {url:'http://127.0.0.1:8787/mcp',method:'POST',body:{jsonrpc:'2.0',id:2,method:'tools/list',params:{}}};
test('only approved loopback health/MCP paths',()=>{
  for(const url of ['http://127.0.0.1:8787/mcp','http://localhost:18080/health','http://[::1]:8787/mcp']) assert.ok(localUrl(url));
  for(const url of ['https://127.0.0.1:8787/mcp','http://example.com:8787/mcp','http://127.0.0.1:80/mcp','http://user@localhost:8787/mcp','http://localhost:8787/api/status','http://localhost:8787/mcp?x=1']) assert.equal(localUrl(url),null);
});
test('JSON and SSE parsing match the request id',()=>{
  assert.deepEqual(parseRpc('event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n\n',2).result,{tools:[]});
  assert.throws(()=>parseRpc('{"jsonrpc":"2.0","id":99,"result":{}}',2),/matching/);
  assert.throws(()=>parseRpc('{"jsonrpc":"2.0","id":2,"error":{"message":"denied"}}',2),/denied/);
});
test('initialize, notification, pagination, session and negotiated protocol, cleanup',async()=>{
  const seen=[];
  const fetcher=async(url,opts)=>{
    const p=opts.body?JSON.parse(opts.body):{}; seen.push({p,opts});
    if(opts.method==='DELETE') return new Response(null,{status:200});
    if(p.method==='initialize') return rpc(p.id,{protocolVersion:'2025-03-26'},{session:'session-a',sse:true});
    assert.equal(opts.headers['Mcp-Session-Id'],'session-a');
    assert.equal(opts.headers['MCP-Protocol-Version'],'2025-03-26');
    if(p.method==='notifications/initialized') return new Response(null,{status:202});
    return p.params.cursor ? rpc(p.id,{tools:[{name:'b'}]},{sse:true}) : rpc(p.id,{tools:[{name:'a'}],nextCursor:'next'});
  };
  const res=await request({...query,token:'test-only'},fetcher);
  assert.deepEqual(JSON.parse(res.responseText).result.tools,[{name:'a'},{name:'b'}]);
  assert.equal(seen.length,5); assert.equal(seen.at(-1).opts.method,'DELETE');
  assert.equal(seen[0].opts.headers.Authorization,'Bearer test-only');
  assert.equal(seen[0].opts.headers.Accept,'application/json, text/event-stream');
  assert.equal(seen[0].opts.redirect,'error');
});
test('HTTP401 is a failure; no tool replay',async()=>{
  let calls=0;
  await assert.rejects(request(query,async()=>{calls++;return new Response('denied',{status:401});}),/HTTP 401/);
  assert.equal(calls,1);
});
test('tool failure cleans up session but does not retry writes',async()=>{
  const seen=[];
  await assert.rejects(request({...query,body:{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'example',arguments:{}}}},async(url,opts)=>{
    const p=opts.body?JSON.parse(opts.body):{}; seen.push(opts.method==='DELETE'?'DELETE':p.method);
    if(opts.method==='DELETE') return new Response(null,{status:200});
    if(p.method==='initialize') return rpc(p.id,{protocolVersion:'2024-11-05'},{session:'s'});
    if(p.method==='notifications/initialized') return new Response(null,{status:202});
    return new Response('error',{status:503});
  }),/HTTP 503/);
  assert.deepEqual(seen,['initialize','notifications/initialized','tools/call','DELETE']);
});
test('MCP isError remains an error result, never rewritten to success',async()=>{
  const res=await request({...query,body:{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'example',arguments:{}}}},async(url,opts)=>{
    const p=JSON.parse(opts.body);
    if(p.method==='initialize') return rpc(p.id,{protocolVersion:'2024-11-05'});
    if(p.method==='notifications/initialized') return new Response(null,{status:202});
    return rpc(p.id,{isError:true,content:[{type:'text',text:'denied'}]});
  });
  assert.equal(JSON.parse(res.responseText).result.isError,true);
});
test('rejects redirects, unsupported requests and duplicate pagination cursor',async()=>{
  await assert.rejects(request({...query,url:'http://remote.test:8787/mcp'}),/approved/);
  await assert.rejects(request({...query,body:{jsonrpc:'2.0',id:1,method:'initialize'}}),/Unsupported/);
  await assert.rejects(request(query,async(url,opts)=>{
    const p=JSON.parse(opts.body);
    if(p.method==='initialize') return rpc(p.id,{});
    if(p.method==='notifications/initialized') return new Response(null,{status:202});
    return rpc(p.id,{tools:[],nextCursor:'repeat'});
  }),/pagination/);
});
test('enforces response byte limit',async()=>{
  await assert.rejects(request({...query,url:'http://127.0.0.1:8787/health',method:'GET'},async()=>new Response('x'.repeat(4*1024*1024+1))),/too large/);
});

test('distributed extension scripts compile and manifest includes Gemini + DeepSeek',()=>{
  const fs=require('node:fs'), path=require('node:path');
  const root=path.resolve(__dirname,'..');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.ok(manifest.host_permissions.includes('https://gemini.google.com/*'));
  assert.ok(manifest.content_scripts[0].matches.includes('https://gemini.google.com/*'));
  assert.ok(manifest.content_scripts[0].matches.includes('https://chat.deepseek.com/*'));
  assert.ok(manifest.content_scripts[0].js.includes('gemini-adapter.js'));
  for(const file of [...manifest.content_scripts[0].js,'mcp-client.js','background.js','popup.js']) {
    assert.doesNotThrow(()=>new Function(fs.readFileSync(path.join(root,file),'utf8')),file);
  }
  assert.ok(fs.existsSync(path.join(root,'LICENSE')));
});
test('timeout stops requests instead of retrying a tool',async()=>{
  let calls=0;
  await assert.rejects(request({...query,timeout:1000},async(url,opts)=>{
    calls++;
    return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError')),{once:true}));
  }),{name:'AbortError'});
  assert.equal(calls,1);
});
