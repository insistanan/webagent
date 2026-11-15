const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const status=require('../project-status.js');
const id='proj-test';
function result(accessMode='read-write',executionMode='disabled') {return {content:[{type:'text',text:JSON.stringify({id,enabled:true,accessMode,executionMode})}]};}
test('read-write with execution disabled is shown as file writable, not read-only',()=>{
  const info=status.extract(result());assert.equal(info.accessMode,'read-write');
  assert.equal(info.executionMode,'disabled');assert.equal(status.describe(info),'文件可读写 · 命令执行关闭');
  assert.ok(status.prompt(info).includes('accessMode=read-write'));assert.ok(status.prompt(info).includes('executionMode=disabled'));
});
test('actual read-only status remains read-only',()=>{
  const info=status.extract(result('read-only'));assert.equal(status.describe(info),'文件只读 · 命令执行关闭');
});
test('MCP errors or missing permission data are not inferred as readonly/writable',()=>{
  assert.throws(()=>status.extract({isError:true,content:[]}),/查询失败/);
  assert.throws(()=>status.extract({content:[{type:'text',text:'not json'}]}),/有效项目权限/);
  assert.ok(status.prompt(null).includes('先调用 nexus_project_info'));
});
test('supports structuredContent without depending on tool text formatting',()=>{
  const info=status.extract({structuredContent:{id,accessMode:'read-write',executionMode:'project-code'}});
  assert.equal(info.executionMode,'project-code');
});
test('queries only project info over MCP, not management endpoints',async()=>{
  const config={webagent_project_id:id,webagent_bridge_url:'http://127.0.0.1:8787',webagent_lb_token:'fake-test-only'};
  const calls=[];const client={request:async req=>{calls.push(req);return {responseText:JSON.stringify({jsonrpc:'2.0',id:2,result:result()})};}};
  const info=await status.read(config,client);assert.equal(info.accessMode,'read-write');assert.equal(calls.length,1);
  assert.equal(calls[0].url,'http://127.0.0.1:8787/mcp');assert.equal(calls[0].body.params.name,'nexus_project_info');
  assert.deepEqual(calls[0].body.params.arguments,{projectId:id});
  assert.ok(!status.prompt(info).includes('fake-test-only'));
});
test('fails closed for missing/mismatched project id',async()=>{
  await assert.rejects(status.read({webagent_project_id:''}),/项目 ID/);
  await assert.rejects(status.read({webagent_project_id:'different',webagent_bridge_url:'http://127.0.0.1:8787'},
    {request:async()=>({responseText:JSON.stringify({result:result()})})}),/不一致/);
});
test('popup loads project status helper and all new scripts compile',()=>{
  const html=fs.readFileSync(require.resolve('../popup.html'),'utf8');
  assert.ok(html.includes('id="projectAccessStatus"'));assert.ok(html.indexOf('src="project-status.js"')<html.indexOf('src="popup.js"'));
  for(const name of ['project-status.js','popup.js'])assert.doesNotThrow(()=>new Function(fs.readFileSync(require.resolve('../'+name),'utf8')));
});
