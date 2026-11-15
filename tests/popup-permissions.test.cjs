const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const status=require('../project-status.js');
const html=fs.readFileSync(require.resolve('../popup.html'),'utf8');
const script=fs.readFileSync(require.resolve('../popup.js'),'utf8');
const version=JSON.parse(fs.readFileSync(require.resolve('../manifest.json'),'utf8')).version;
async function popup(options={}) {
  let init,info={id:'test-project',accessMode:'read-write',executionMode:'project-code'};
  const elements={};for(const [,id] of html.matchAll(/id="([^"]+)"/g))elements[id]={value:'',textContent:'',checked:false,disabled:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
  const saved={webagent_project_id:'test-project',webagent_auto_execute:false,webagent_management_token:'fake-popup-test-only',...options.saved};
  const writes=[],messages=[],confirms=[],copies=[];
  const context={URL,document:{addEventListener:(name,fn)=>init=fn,getElementById:id=>elements[id]},
    WebAgentMcp:{localUrl:url=>url.startsWith('http://127.0.0.1:8787/')?{href:url}:null,request:async()=>({responseText:JSON.stringify({result:{tools:[]}})})},
    WebAgentProjectStatus:{...status,read:async()=>({...info})},WebAgentAutoSend:require('../auto-send.js'),
    confirm:message=>{confirms.push(message);return options.confirm!==false;},navigator:{clipboard:{writeText:async text=>copies.push(text)}},
    chrome:{tabs:options.tabs,storage:{local:{get:async defaults=>({...defaults,...saved}),set:async config=>{writes.push({...config});Object.assign(saved,config);}}},
      runtime:{getManifest:()=>({version}),sendMessage:async req=>{messages.push({...req});if(options.fail)return {success:false,error:'test failure'};
        info=req.setting==='access'?{...info,accessMode:req.value,...(req.value==='read-only'?{executionMode:'disabled'}:{})}:
          {...info,executionMode:req.value,...(req.value==='project-code'?{accessMode:'read-write'}:{})};return {success:true,project:info};}}}};
  vm.runInNewContext(script,context);await init();
  async function click(id,isTrusted=true){await elements[id].listeners.click({isTrusted});}
  return {elements,writes,messages,confirms,copies,saved,click};
}
test('popup includes file and command permissions and initializes actual server state',async()=>{
  const p=await popup();assert.equal(p.elements.projectAccessSelect.value,'read-write');assert.equal(p.elements.projectExecutionSelect.value,'project-code');
  assert.match(p.elements.projectAccessStatus.textContent,/文件可读写.*项目代码执行启用/);
  assert.ok(html.includes('type="password" autocomplete="off"'));assert.ok(html.includes('id="managementTokenFile"'));
});
test('synthetic permission clicks never send a management message',async()=>{
  const p=await popup();await p.click('applyExecutionBtn',false);assert.equal(p.messages.length,0);assert.equal(p.writes.length,0);assert.equal(p.confirms.length,0);
});
test('cancelled confirmation, missing token and unsaved project cannot change permissions',async()=>{
  for(const options of [{confirm:false},{saved:{webagent_management_token:''}},{}]){
    const p=await popup(options);if(!Object.keys(options).length)p.elements.projectIdInput.value='unsaved';
    await p.click('applyExecutionBtn');assert.equal(p.messages.length,0);assert.equal(p.writes.length,0);
  }
});
test('enabling command execution warns about coupled write permission and outside effects',async()=>{
  const p=await popup();p.elements.autoExecuteToggle.checked=true;
  await p.click('applyExecutionBtn');assert.equal(p.messages.length,1);assert.match(p.confirms[0],/文件权限设为可读写/);assert.match(p.confirms[0],/项目外副作用/);
  assert.deepEqual(Object.keys(p.writes[0]),['webagent_management_token']);assert.equal(p.saved.webagent_auto_execute,false);
  assert.equal(p.messages[0].setting,'execution');assert.equal(p.messages[0].value,'project-code');
  assert.ok(!JSON.stringify(p.messages).includes('fake-popup-test-only'));assert.equal(p.elements.applyExecutionBtn.disabled,false);
});
test('readonly warns of command disable and refreshes both selectors',async()=>{
  const p=await popup();p.elements.projectAccessSelect.value='read-only';await p.click('applyAccessBtn');
  assert.match(p.confirms[0],/关闭该项目的命令执行/);assert.equal(p.elements.projectExecutionSelect.value,'disabled');assert.equal(p.elements.projectAccessSelect.value,'read-only');
});
test('failure refreshes actual state but never retries write automatically',async()=>{
  const p=await popup({fail:true});p.elements.projectExecutionSelect.value='disabled';await p.click('applyExecutionBtn');
  assert.equal(p.messages.length,1);assert.match(p.elements.permissionNotice.textContent,/test failure/);assert.equal(p.elements.projectExecutionSelect.value,'project-code');
  assert.equal(p.elements.applyExecutionBtn.disabled,false);assert.equal(p.elements.applyAccessBtn.disabled,false);
});
test('copied protocol includes fresh state without management or Bridge credentials',async()=>{
  const p=await popup({saved:{webagent_lb_token:'fake-bridge-test-only'}});await p.click('injectPromptBtn');
  assert.equal(p.copies.length,1);assert.match(p.copies[0],/accessMode=read-write；executionMode=project-code/);assert.ok(!p.copies[0].includes('fake-'));
});
test('management file import remains private, rejects multiline and oversized files',async()=>{
  const p=await popup();
  async function file(size,text){const target={value:'file',files:[{size,text:async()=>text}]};await p.elements.managementTokenFile.listeners.change({target});return target;}
  assert.equal((await file(10,'new-test-token')).value,'');assert.equal(p.elements.managementTokenInput.value,'new-test-token');
  await file(10,'bad\nfile');assert.equal(p.elements.managementTokenInput.value,'new-test-token');assert.match(p.elements.permissionNotice.textContent,/仅包含/);
  await file(10000,'too large');assert.match(p.elements.permissionNotice.textContent,/过大/);assert.equal(p.messages.length,0);assert.equal(p.copies.length,0);
});

test('popup saves independent automatic execution/send combinations and restores preferences',async()=>{
  for(const execute of [false,true])for(const send of [false,true]){
    const p=await popup();p.elements.autoExecuteToggle.checked=execute;p.elements.autoSendToggle.checked=send;
    await p.click('saveConfigBtn');assert.equal(p.saved.webagent_auto_execute,execute);assert.equal(p.saved.webagent_auto_send,send);
    const restored=await popup({saved:{webagent_auto_execute:execute,webagent_auto_send:send}});
    assert.equal(restored.elements.autoExecuteToggle.checked,execute);assert.equal(restored.elements.autoSendToggle.checked,send);
  }
});
test('declining auto-send confirmation leaves persisted preferences unchanged',async()=>{
  const p=await popup({confirm:false});p.elements.autoSendToggle.checked=true;await p.click('saveConfigBtn');
  assert.equal(p.writes.length,0);assert.equal(p.saved.webagent_auto_send,undefined);assert.match(p.confirms[0],/已有草稿/);
});

test('popup diagnoses old page content and offers user-controlled refresh',async()=>{
  const reloads=[];const tabs={query:async()=>[{id:7,url:'https://gemini.google.com/app/test'}],sendMessage:async()=>{throw Error('Receiving end does not exist');},reload:async id=>reloads.push(id)};
  const p=await popup({tabs});assert.match(p.elements.pageVersionStatus.textContent,/旧版或脚本已失效/);assert.equal(p.elements.reloadPageBtn.disabled,false);
  await p.click('reloadPageBtn',false);assert.equal(reloads.length,0);
  await p.click('reloadPageBtn');assert.deepEqual(reloads,[7]);assert.match(p.confirms[0],/保存发送栏/);
});
test('popup shows matched page version and actual auto-send state without resetting choices',async()=>{
  const tabs={query:async()=>[{id:8,url:'https://gemini.google.com/app/test'}],sendMessage:async()=>({version,connected:true,autoSend:true})};
  const p=await popup({tabs,saved:{webagent_auto_send:true,webagent_auto_execute:true}});
  assert.match(p.elements.pageVersionStatus.textContent,new RegExp('网页 '+version.replaceAll('.','\\.')+'.*MCP 在线.*自动发送开启'));assert.equal(p.writes.length,0);assert.equal(p.elements.autoSendToggle.checked,true);
});
test('version mismatch, cancelled refresh and unrelated tabs never reload automatically',async()=>{
  let reloads=0;const tabs={query:async()=>[{id:9,url:'https://chat.deepseek.com/'}],sendMessage:async()=>({version:'1.3.1'}),reload:async()=>reloads++};
  const p=await popup({tabs,confirm:false});assert.match(p.elements.pageVersionStatus.textContent,/旧脚本/);await p.click('reloadPageBtn');assert.equal(reloads,0);
  const unrelated=await popup({tabs:{...tabs,query:async()=>[{id:10,url:'https://example.org/'}]}});assert.equal(unrelated.elements.reloadPageBtn.disabled,true);assert.match(unrelated.elements.pageVersionStatus.textContent,/AI 标签页/);assert.equal(reloads,0);
});

test('popup reports latest invalid tool and exact cancellation without private content',async()=>{
  const tabs={query:async()=>[{id:8,url:'https://gemini.google.com/app/test'}],sendMessage:async()=>({version,connected:true,autoSend:true,
    toolParse:{status:'incomplete'},autoSendStatus:{sent:false,reason:'input-changed'}})};
  const p=await popup({tabs});assert.match(p.elements.pageVersionStatus.textContent,/JSON 被截断，未执行/);
  assert.match(p.elements.pageVersionStatus.textContent,/输入框已重建/);assert.equal(p.writes.length,0);
  assert.equal(p.elements.pageVersionStatus.textContent.includes('fake-'),false);
});

test('upstream distribution has no preconfigured project or personal workspace',()=>{
  assert.match(script,/webagent_workspace_dir: '', webagent_project_id: ''/);
  assert.equal(/proj_[0-9a-f-]{36}|杂活文件|本地agent/.test(script),false);
});

test('popup exposes default enabled breaker with 20 rounds, persisting user opt-out independently',async()=>{
  const p=await popup({saved:{webagent_auto_execute:true,webagent_auto_send:true}});assert.equal(p.elements.circuitBreakerToggle.checked,true);
  p.elements.circuitBreakerToggle.checked=false;await p.click('saveConfigBtn');assert.equal(p.saved.webagent_circuit_breaker,false);assert.equal(p.saved.webagent_max_consecutive_steps,20);
  assert.equal(p.saved.webagent_auto_execute,true);assert.equal(p.saved.webagent_auto_send,true);assert.match(p.confirms[0],/关闭熔断保护/);
  const restored=await popup({saved:{webagent_circuit_breaker:false}});assert.equal(restored.elements.circuitBreakerToggle.checked,false);
  restored.elements.circuitBreakerToggle.checked=true;await restored.click('saveConfigBtn');assert.equal(restored.saved.webagent_circuit_breaker,true);assert.equal(restored.confirms.length,0);
});
test('declining breaker opt-out saves nothing and does not reset any user switches',async()=>{
  const p=await popup({confirm:false});p.elements.circuitBreakerToggle.checked=false;await p.click('saveConfigBtn');
  assert.equal(p.writes.length,0);assert.equal(p.saved.webagent_circuit_breaker,undefined);assert.equal(p.saved.webagent_auto_execute,false);assert.equal(p.elements.circuitBreakerToggle.checked,true);
});
test('popup diagnostics show breaker and pause state, and copied protocol describes the limit without secrets',async()=>{
  const tabs={query:async()=>[{id:8,url:'https://gemini.google.com/app/test'}],sendMessage:async()=>({version,connected:true,autoSend:false,circuitBreaker:true,maxConsecutiveSteps:20,suspended:true})};
  const p=await popup({tabs});assert.match(p.elements.pageVersionStatus.textContent,/熔断开启.*20 轮.*已暂停/);
  await p.click('injectPromptBtn');assert.match(p.copies[0],/熔断保护=true.*20 轮/);assert.ok(!p.copies[0].includes('fake-'));
});
