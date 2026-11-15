const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {sendDraft}=require('../auto-send.js');
const {writeToDraft}=require('../draft-output.js');
function fixture(){
  const input={value:'result',isConnected:true,getAttribute:()=>null};let clicks=0,clock=0;
  const button={isConnected:true,disabled:false,getAttribute:()=>null,click:()=>clicks++};
  const adapter={getInput:()=>input,setValue:(el,text)=>el.value=text,isGenerating:()=>false,getSendBtn:()=>button};
  const draft={written:true,input,text:'result'};
  const options={enabled:()=>true,delayMs:0,timeoutMs:500,now:()=>clock,wait:async ms=>clock+=ms};
  return {input,button,adapter,draft,options,get clicks(){return clicks;}};
}
test('default/disabled automation never even queries Send',async()=>{
  const f=fixture();f.adapter.getSendBtn=()=>{throw Error('Must not query send');};
  assert.equal((await sendDraft(f.adapter,f.draft)).sent,false);assert.equal(f.clicks,0);
});
test('enabled automation clicks Send once including preserved draft, with no Enter',async()=>{
  const f=fixture();f.input.value='existing draft';const draft=await writeToDraft(f.adapter,'result');
  assert.equal(draft.text,'existing draft\n\nresult');assert.equal((await sendDraft(f.adapter,draft,f.options)).sent,true);assert.equal(f.clicks,1);
});
test('switch off during delay cancels pending send immediately',async()=>{
  const f=fixture();let enabled=true;f.options.enabled=()=>enabled;f.options.delayMs=1000;
  f.options.wait=async()=>{enabled=false;};assert.equal((await sendDraft(f.adapter,f.draft,f.options)).reason,'disabled');assert.equal(f.clicks,0);
});
test('user edit or manual submission prevents sending/replaying old result',async()=>{
  for(const value of ['user edit','']){const f=fixture();f.input.value=value;
    assert.equal((await sendDraft(f.adapter,f.draft,f.options)).reason,'draft-changed');assert.equal(f.clicks,0);}
});
test('navigation, detached or replaced input cancels submission',async()=>{
  for(const change of ['detached','replaced']){const f=fixture();if(change==='detached')f.input.isConnected=false;else f.adapter.getInput=()=>({...f.input});
    assert.equal((await sendDraft(f.adapter,f.draft,f.options)).reason,'input-changed');assert.equal(f.clicks,0);}
});
test('waits for send readiness, but disabled, hidden and absent buttons have bounded wait',async()=>{
  for(const kind of ['disabled','hidden','missing','generating']){
    const f=fixture();if(kind==='disabled')f.button.disabled=true;if(kind==='hidden')f.button.getClientRects=()=>[];
    if(kind==='missing')f.adapter.getSendBtn=()=>null;if(kind==='generating')f.adapter.isGenerating=()=>true;
    assert.equal((await sendDraft(f.adapter,f.draft,f.options)).reason,'unavailable');assert.equal(f.clicks,0);
  }
  const f=fixture();f.button.disabled=true;const wait=f.options.wait;f.options.wait=async ms=>{await wait(ms);f.button.disabled=false;};
  assert.equal((await sendDraft(f.adapter,f.draft,f.options)).sent,true);assert.equal(f.clicks,1);
});
test('duplicate result is never automatically sent again',async()=>{
  const f=fixture();const draft=await writeToDraft(f.adapter,'result');assert.equal(draft.alreadyPresent,true);
  assert.equal((await sendDraft(f.adapter,draft,f.options)).sent,false);assert.equal(f.clicks,0);
});
test('submission click error is not retried',async()=>{
  const f=fixture();let calls=0;f.button.click=()=>{calls++;throw Error('unknown send outcome');};
  await assert.rejects(sendDraft(f.adapter,f.draft,f.options),/unknown send outcome/);assert.equal(calls,1);
});
test('rich text trailing paragraph newline is supported without losing content check',async()=>{
  const f=fixture();delete f.input.value;f.input.innerText='result\n';assert.equal((await sendDraft(f.adapter,f.draft,f.options)).sent,true);
});
test('content queue respects current autoSend and ignores autoExecute coupling',async()=>{
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const a=source.indexOf('  // Results go directly to the input.');const b=source.indexOf('\n  function checkAndHandleRateLimitError()',a);
  for(const autoExecute of [false,true])for(const autoSend of [false,true]){
    const f=fixture();f.input.value='';const config={autoExecute,autoSend,sendDelay:0};
    const context={WebAgentDraftOutput:{writeToDraft},WebAgentAutoSend:{sendDraft},currentAdapter:f.adapter,CONFIG:config,
      extensionContextInvalid:false,extensionContextAlive:()=>true,location:{href:'https://gemini.google.com/app/test'},countdownTimer:null,showToast:()=>{},webagentOfferResultCopy:()=>{}};
    vm.runInNewContext(source.slice(a,b)+'\nglobalThis.dispatch=safeDispatchFeedbackToChat;globalThis.finished=()=>draftWriteQueue;',context);
    context.dispatch('result','test');await context.finished();assert.equal(f.clicks,autoSend?1:0);assert.equal(f.input.value,'result');
  }
});

function pageControls(confirm=true){
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const start=source.indexOf('    // 8. 设置项：自动执行开关');const end=source.indexOf('    // 9. 设置项：自动发送延迟缓冲滑动条',start);
  const config={autoExecute:false,autoSend:false},controls={},writes=[];
  for(const id of ['#nexus-cfg-auto','#nexus-cfg-send'])controls[id]={checked:false,addEventListener:(name,fn)=>controls[id].change=fn};
  vm.runInNewContext(source.slice(start,end),{CONFIG:config,drawerEl:{querySelector:id=>controls[id]},confirm:()=>confirm,showToast:()=>{},GM_setValue:(key,val)=>writes.push([key,val])});
  return {config,controls,writes,change:(id,isTrusted=true)=>controls[id].change({target:controls[id],isTrusted})};
}
test('webpage panel exposes both switches and only trusted changes persist',()=>{
  const p=pageControls();p.controls['#nexus-cfg-auto'].checked=true;p.change('#nexus-cfg-auto',false);assert.equal(p.config.autoExecute,false);assert.equal(p.writes.length,0);
  p.controls['#nexus-cfg-send'].checked=true;p.change('#nexus-cfg-send');assert.equal(p.config.autoSend,true);assert.equal(p.config.autoExecute,false);
  p.controls['#nexus-cfg-auto'].checked=true;p.change('#nexus-cfg-auto');assert.equal(p.config.autoExecute,true);assert.equal(p.config.autoSend,true);
  p.controls['#nexus-cfg-send'].checked=false;p.change('#nexus-cfg-send');assert.equal(p.config.autoSend,false);assert.equal(p.config.autoExecute,true);
});
test('cancelled panel opt-in does not persist either switch',()=>{
  const p=pageControls(false);for(const id of Object.keys(p.controls)){p.controls[id].checked=true;p.change(id);assert.equal(p.controls[id].checked,false);}
  assert.equal(p.config.autoExecute,false);assert.equal(p.config.autoSend,false);assert.equal(p.writes.length,0);
});

const gemini=require('../gemini-adapter.js');
function paragraph(value){const children=value===''?[{nodeName:'BR',nodeType:1,childNodes:[]}]:[{nodeType:3,textContent:value}];return {tagName:'P',childNodes:children,firstChild:children[0]};}
test('Gemini canonical text ignores innerText blank paragraph inflation',()=>{const input={children:['first','','third',''].map(paragraph),innerText:'first\n\n\nthird\n\n'};assert.equal(gemini.getValue(input),'first\n\nthird\n');});
test('Gemini multiline auto-send uses logical editor content and still protects edits',async()=>{
  const f=fixture();delete f.input.value;f.input.innerText='first\n\n\nthird';f.input.children=['first','','third'].map(paragraph);f.adapter.getValue=gemini.getValue;f.draft.text='first\n\nthird';
  assert.equal((await sendDraft(f.adapter,f.draft,f.options)).sent,true);assert.equal(f.clicks,1);
  f.input.children[2]=paragraph('user edit');assert.equal((await sendDraft(f.adapter,f.draft,f.options)).reason,'draft-changed');assert.equal(f.clicks,1);
});
test('draft append uses canonical Gemini text instead of duplicating rendered blank lines',async()=>{
  const f=fixture();delete f.input.value;f.input.innerText='first\n\n\nthird';f.input.children=['first','','third'].map(paragraph);f.adapter.getValue=gemini.getValue;let written;f.adapter.setValue=(el,text)=>written=text;
  const draft=await writeToDraft(f.adapter,'tool result');assert.equal(written,'first\n\nthird\n\ntool result');assert.equal(draft.text,written);
});

test('auto-send diagnostics identify blocked generation, input and button without draft text',async()=>{
  const {describe}=require('../auto-send.js');
  for(const kind of ['generation','input-disabled','send-button']) {
    const f=fixture();if(kind==='generation')f.adapter.isGenerating=()=>true;
    if(kind==='input-disabled')f.input.disabled=true;if(kind==='send-button')f.adapter.getSendBtn=()=>null;
    const result=await sendDraft(f.adapter,f.draft,f.options);assert.equal(result.waitingFor,kind);
    assert.match(describe(result),/自动发送未完成/);assert.equal(JSON.stringify(result).includes('result'),false);
  }
  assert.match(describe({sent:false,reason:'draft-changed'}),/内容发生变化/);
  assert.match(describe({sent:false,reason:'input-changed'}),/输入框已重建/);
});
