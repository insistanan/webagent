const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function adapterFixture(label,latest=true,disabled=false){
  const first={getClientRects:()=>[1],closest:()=>null},last={getClientRects:()=>[1],closest:()=>null};
  const button={disabled,getClientRects:()=>[1],getAttribute:key=>key==='aria-label'?label:null,closest:selector=>selector==='model-response'?(latest?last:first):null};
  const target={closest:()=>button};const context={document:{querySelectorAll:()=>[first,last]}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../gemini-adapter.js'),'utf8'),context);
  return {adapter:context.WebAgentGeminiAdapter,target};
}
test('Gemini actual 重做 button arms only the latest visible response',()=>{
  for(const label of ['重做','重新生成','重新回答','重试','Regenerate','Try again']) {
    const f=adapterFixture(label);assert.equal(f.adapter.isRegenerateTarget(f.target),true);
    const historical=adapterFixture(label,false);assert.equal(historical.adapter.isRegenerateTarget(historical.target),false);
    const disabled=adapterFixture(label,true,true);assert.equal(disabled.adapter.isRegenerateTarget(disabled.target),false);
  }
});
test('previous/next versions and Copy are never regenerate actions',()=>{
  for(const label of ['上一版本','下一版本','复制','复制代码']) {
    const f=adapterFixture(label);assert.equal(f.adapter.isRegenerateTarget(f.target),false);
    assert.equal(f.adapter.isHistoryTarget(f.target),/版本/.test(label));
  }
});
test('only trusted regenerate/history clicks arm or cancel the response gate',()=>{
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const start=source.indexOf('    document.addEventListener(\'click\',event=>{',source.indexOf('  function startReActLoop('));
  const end=source.indexOf("    document.addEventListener('keydown'",start);
  let handler,submitted=0,cancelled=0;
  const context={document:{addEventListener:(event,fn)=>handler=fn},extensionContextAlive:()=>true,
    currentAdapter:{getSendBtn:()=>null,getLastReplyText:()=>'',isRegenerateTarget:t=>t==='regenerate',isHistoryTarget:t=>t==='history'},
    replyGate:{submit:()=>submitted++,cancel:()=>cancelled++},location:{href:'/a'}};
  vm.runInNewContext(source.slice(start,end),context);
  handler({target:'regenerate',isTrusted:false});assert.equal(submitted,0);
  handler({target:'regenerate',isTrusted:true});assert.equal(submitted,1);
  handler({target:'history',isTrusted:false});assert.equal(cancelled,0);
  handler({target:'history',isTrusted:true});assert.equal(cancelled,1);
});

test('Gemini only allows empty-chat to assigned conversation route, never other histories',()=>{
  const context={URL};vm.runInNewContext(fs.readFileSync(require.resolve('../gemini-adapter.js'),'utf8'),context);
  const adapter=context.WebAgentGeminiAdapter;
  assert.equal(adapter.isNewConversationRoute('https://gemini.google.com/app?hl=zh-cn','https://gemini.google.com/app/123abc?hl=zh-cn'),true);
  for(const [a,b] of [['https://gemini.google.com/app/old','https://gemini.google.com/app/new'],
    ['https://gemini.google.com/app','https://other.example/app/new'],['https://gemini.google.com/app/new','https://gemini.google.com/app']])assert.equal(adapter.isNewConversationRoute(a,b),false);
});
test('first reply migration verifies the actual first user query rather than guessing from URL',()=>{
  let queries=[];const context={document:{querySelectorAll:()=>queries}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../gemini-adapter.js'),'utf8'),context);
  const adapter=context.WebAgentGeminiAdapter;
  assert.equal(adapter.matchesFirstSubmission('first\nsecond'),null);
  queries=[{querySelectorAll:()=>[{textContent:' first '},{textContent:'second'}]}];
  assert.equal(adapter.matchesFirstSubmission('first\nsecond'),true);assert.equal(adapter.matchesFirstSubmission('different'),false);
  queries.push(queries[0]);assert.equal(adapter.matchesFirstSubmission('first\nsecond'),false);
});

test('manual Send starts a fresh task budget but automatic feedback clicks cannot reset it',()=>{
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const start=source.indexOf('    function armReply(isTrusted)');const end=source.indexOf('    replyGate.route(loopRoute);',start);
  const goals=[],submits=[];const context={pendingUserText:'',currentAdapter:{getInput:()=>({value:'new user task'}),getLastReplyText:()=>''},
    recordUserGoal:t=>goals.push(t),replyGate:{submit:(...args)=>submits.push(args)},location:{href:'/app'}};
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.arm=armReply;',context);
  context.arm(false);assert.equal(goals.length,0);context.arm(true);assert.deepEqual(goals,['new user task']);assert.equal(submits.length,2);
});
test('error feedback cannot invite operations outside the user authorized scope',()=>{
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8');assert.match(source,/严格遵守用户本次授权范围/);
  assert.match(source,/若用户限定只调用一次/);
});
