const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=require('../permission-client.js');
const mcp=require('../mcp-client.js');
const runtime={id:'test-extension',getURL:path=>'chrome-extension://test-extension/'+path};
const sender={id:runtime.id,url:runtime.getURL('popup.html')};
const settings={webagent_project_id:'proj-test',webagent_management_token:'fake-test-management'};
const request={action:'set_project_permission',projectId:'proj-test',setting:'execution',value:'project-code'};
const project={id:'proj-test',name:'test',enabled:true,accessMode:'read-write',executionMode:'project-code'};
const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
test('only extension action popup is allowed, never website, other extension or extension tab',()=>{
  assert.equal(api.trustedPopup(sender,runtime),true);
  for(const input of [undefined,{...sender,id:'other'}, {...sender,url:'https://gemini.google.com/'},
    {...sender,url:runtime.getURL('popup.html')+'?query'}, {...sender,tab:{id:1}}])assert.equal(api.trustedPopup(input,runtime),false);
});
test('limits permissions to exact enums, saved project and configured management token',()=>{
  assert.deepEqual(api.validate(request,settings),{url:'http://127.0.0.1:18080/api/management/projects/proj-test/execution',body:{executionMode:'project-code'}});
  assert.deepEqual(api.validate({...request,setting:'access',value:'read-only'},settings).body,{accessMode:'read-only'});
  assert.throws(()=>api.validate({...request,value:'full-access'},settings),/不支持/);
  assert.throws(()=>api.validate({...request,projectId:'different'},settings),/已保存/);
  assert.throws(()=>api.validate(request,{...settings,webagent_management_token:''}),/管理令牌/);
});
test('checks registration, performs one POST, verifies state; never returns secrets',async()=>{
  const calls=[];
  const result=await api.change(request,settings,async(url,options)=>{
    calls.push({url,options});return response({projects:[{...project,token:'must-not-return'}]});
  });
  assert.deepEqual(calls.map(c=>c.options.method||'GET'),['GET','POST','GET']);
  assert.deepEqual(JSON.parse(calls[1].options.body),{executionMode:'project-code'});
  for(const {url,options} of calls){assert.ok(url.startsWith('http://127.0.0.1:18080/api/'));assert.equal(options.headers.Authorization,'Bearer '+settings.webagent_management_token);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.ok(options.signal);}
  assert.deepEqual(result,project);assert.ok(!JSON.stringify(result).includes('fake-test-management'));assert.ok(!('token' in result));
});
test('unregistered project causes no write',async()=>{
  let calls=0;await assert.rejects(api.change(request,settings,async()=>{calls++;return response({projects:[]});}),/未登记/);assert.equal(calls,1);
});
test('401 and failed mutation do not replay a write',async()=>{
  for(const status of [401,503]){
    const methods=[];
    await assert.rejects(api.change(request,settings,async(url,options)=>{
      methods.push(options.method||'GET');return options.method==='POST'?new Response('',{status}):response({projects:[project]});
    }),status===401?/管理令牌无效/:/HTTP 503/);
    assert.deepEqual(methods,['GET','POST']);
  }
});
test('timeout or post-write verification error never replays mutation',async()=>{
  for(const failure of ['timeout','mismatch']){
    const methods=[];
    await assert.rejects(api.change(request,settings,async(url,options)=>{
      methods.push(options.method||'GET');
      if(options.method==='POST'&&failure==='timeout')throw new DOMException('test','TimeoutError');
      return response({projects:[methods.length===3?{...project,executionMode:'disabled'}:project]});
    }),failure==='timeout'?{name:'TimeoutError'}:/状态不一致/);
    assert.equal(methods.filter(m=>m==='POST').length,1);
  }
});
test('read-only application returns coupled execution-disabled server state',async()=>{
  const readonly={...project,accessMode:'read-only',executionMode:'disabled'};
  assert.deepEqual(await api.change({...request,setting:'access',value:'read-only'},settings,async()=>response({projects:[readonly]})),readonly);
});
function background(change){
  let listener,reads=0;
  const context={WebAgentMcp:mcp,WebAgentPermissionClient:{...api,change},importScripts:()=>{},
    chrome:{runtime:{...runtime,onInstalled:{addListener:()=>{}},onMessage:{addListener:f=>listener=f}},
      storage:{local:{get:async()=>{reads++;return settings;}}},action:{}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../background.js'),'utf8'),context);
  return {call:(req,from)=>new Promise(resolve=>{const pending=listener(req,from,resolve);if(!pending)resolve(undefined);}),get reads(){return reads;}};
}
test('background rejects website permission messages without accessing storage or management',async()=>{
  let mutations=0;const bg=background(async()=>{mutations++;return project;});
  const result=await bg.call(request,{...sender,url:'https://gemini.google.com/',tab:{id:1}});
  assert.equal(result.success,false);assert.equal(mutations,0);assert.equal(bg.reads,0);
  const accepted=await bg.call(request,sender);assert.equal(accepted.success,true);assert.equal(mutations,1);
});
test('generic bridge proxy cannot reach management endpoints or remote hosts',()=>{
  for(const url of ['http://127.0.0.1:18080/api/projects','http://127.0.0.1:18080/api/management/projects/proj-test/access','https://gemini.google.com/mcp'])assert.equal(mcp.localUrl(url),null);
});
test('management token is excluded from content config, prompt and clipboard code',()=>{
  const content=fs.readFileSync(require.resolve('../content.js'),'utf8');
  assert.ok(content.includes("!['webagent_management_token','webagent_lb_token','nexus_lb_token'].includes(key)"));
  assert.ok(content.includes("if (key === 'webagent_management_token') return;"));
  const popup=fs.readFileSync(require.resolve('../popup.js'),'utf8');
  assert.ok(!popup.slice(popup.indexOf("$('injectPromptBtn')")).includes('management_token'));
  for(const file of ['permission-client.js','background.js','popup.js','content.js'])assert.doesNotThrow(()=>new Function(fs.readFileSync(require.resolve('../'+file),'utf8')));
});
