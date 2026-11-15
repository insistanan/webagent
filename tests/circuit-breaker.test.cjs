const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../content.js'),'utf8').replace(/\r\n/g,'\n');
function fixture(options={}){
  const calls=[],feedback=[],toasts=[],pending=[];
  const CONFIG={autoExecute:true,autoSend:false,circuitBreaker:true,maxConsecutiveSteps:20,...options.config};
  const context={CONFIG,console,showToast:text=>toasts.push(text),isLikelyValidTool:tool=>tool!=='invalid',
    webagentReviewTool:async()=>options.approved!==false,recordTaskStep:()=>{},
    safeDispatchFeedbackToChat:text=>feedback.push(text),
    executeNexusTool:(tool,args,callback)=>{calls.push({tool,args});if(options.pending){pending.push(callback);return;}
      callback(options.result?options.result(calls.length):{ok:true,result:'result-'+calls.length});}};
  const start=source.indexOf('  let consecutiveAutoDispatches = 0;');
  const end=source.indexOf('  // Results go directly',start);
  assert.ok(start>=0 && end>start);
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.dispatch=handleToolCallAutomatically;globalThis.reset=resetReActSafetyState;globalThis.toggle=setCircuitBreakerEnabled;globalThis.state=()=>({rounds:consecutiveAutoDispatches,errors:consecutiveErrors,suspended:isAutoDispatchSuspended,repeats:duplicateToolCallCount});',context);
  return {context,CONFIG,calls,feedback,toasts,pending,call:(n=1)=>context.dispatch({tool:'nexus_project_info',args:{projectId:'test-project',step:n}})};
}
test('enabled circuit breaker permits exactly 20 actual calls and blocks call 21',async()=>{
  const f=fixture();for(let i=0;i<20;i++)await f.call(i);assert.equal(f.calls.length,20);assert.equal(f.context.state().rounds,20);
  await f.call(20);assert.equal(f.calls.length,20);assert.equal(f.context.state().suspended,true);assert.match(f.feedback.at(-1),/20/);
  await f.call(21);assert.equal(f.calls.length,20);
});
test('legacy four-round budget is raised to 20, and failures count exactly once',async()=>{
  const f=fixture({config:{maxConsecutiveSteps:4},result:n=>n%2?{ok:false,error:'test error'}:{ok:true,result:'step-'+n}});
  for(let i=0;i<20;i++)await f.call(i);await f.call(20);assert.equal(f.calls.length,20);assert.equal(f.context.state().rounds,20);
});
test('same arguments with changing tool results are progress, not duplicate loops',async()=>{
  const f=fixture();for(let i=0;i<20;i++)await f.call();assert.equal(f.calls.length,20);assert.equal(f.context.state().suspended,false);
});
test('three completed equal calls and results suspend before a fourth, not based on args alone',async()=>{
  const f=fixture({result:()=>({ok:true,result:'unchanged'})});for(let i=0;i<3;i++)await f.call();assert.equal(f.context.state().suspended,false);
  await f.call();assert.equal(f.calls.length,3);assert.equal(f.context.state().rounds,3);assert.equal(f.context.state().suspended,true);
});
test('equal results with different arguments are not duplicate calls',async()=>{
  const f=fixture({result:()=>({ok:true,result:'unchanged'})});for(let i=0;i<20;i++)await f.call(i);assert.equal(f.calls.length,20);assert.equal(f.context.state().suspended,false);
});
test('five failures really suspend, while all five errors including the last are returned',async()=>{
  const f=fixture({result:()=>({ok:false,error:'test denied'})});for(let i=0;i<5;i++)await f.call();assert.equal(f.calls.length,5);assert.equal(f.feedback.length,5);
  assert.equal(f.context.state().rounds,5);assert.equal(f.context.state().errors,5);assert.equal(f.context.state().suspended,true);assert.match(f.feedback[4],/test denied.*[\s\S]*熔断保护/);
  await f.call();assert.equal(f.calls.length,5);
});
test('success clears consecutive failures without resetting the total budget',async()=>{
  const f=fixture({result:n=>n%5===0?{ok:true,result:'success-'+n}:{ok:false,error:'denied'}});
  for(let i=0;i<20;i++)await f.call(i);assert.equal(f.calls.length,20);assert.equal(f.context.state().errors,0);assert.equal(f.context.state().rounds,20);
});
test('disabled breaker does not cap rounds, repeated successes, failures or error feedback',async()=>{
  for(const result of [()=>({ok:true,result:'same'}),()=>({ok:false,error:'test denied'})]){
    const f=fixture({config:{circuitBreaker:false},result});for(let i=0;i<30;i++)await f.call();
    assert.equal(f.calls.length,30);assert.equal(f.feedback.length,30);assert.equal(f.context.state().rounds,30);assert.equal(f.context.state().suspended,false);
  }
});
test('switch off releases suspension, switch on starts a fresh budget, independent of execute/send',async()=>{
  const f=fixture({result:()=>({ok:true,result:'same'})});for(let i=0;i<4;i++)await f.call();assert.equal(f.context.state().suspended,true);
  f.context.toggle(false);assert.equal(f.context.state().suspended,false);await f.call();assert.equal(f.calls.length,4);
  f.context.toggle(true);assert.equal(f.context.state().rounds,0);assert.equal(f.context.state().errors,0);assert.equal(f.context.state().repeats,0);
  assert.equal(f.CONFIG.autoExecute,true);assert.equal(f.CONFIG.autoSend,false);
});
test('cancelled approvals and invalid tools never consume rounds even with breaker off',async()=>{
  const f=fixture({config:{autoExecute:false,circuitBreaker:false},approved:false});await f.call();assert.equal(f.calls.length,0);assert.equal(f.context.state().rounds,0);
  const g=fixture({config:{circuitBreaker:false}});await g.context.dispatch({tool:'invalid',args:{}});assert.equal(g.calls.length,0);assert.equal(g.context.state().rounds,0);
});
test('manual approved calls count once, and automatic sending is not required for the limit',async()=>{
  const f=fixture({config:{autoExecute:false,autoSend:false}});for(let i=0;i<21;i++)await f.call(i);assert.equal(f.calls.length,20);assert.equal(f.context.state().rounds,20);
});
test('a stale completion after a new task cannot charge its error or duplicate counters',async()=>{
  const f=fixture({pending:true});await f.call();assert.equal(f.context.state().rounds,1);f.context.reset();
  f.pending[0]({ok:false,error:'old task error'});assert.equal(f.context.state().rounds,0);assert.equal(f.context.state().errors,0);assert.equal(f.context.state().suspended,false);
});
test('short trusted user goals reset counters, draft fills cannot reset budgets',async()=>{
  const f=fixture();await f.call();
  Object.assign(f.context,{getHandoverState:()=>({}),saveHandoverState:()=>{}});
  const a=source.indexOf('  function recordUserGoal('),b=source.indexOf('  // 1. 单次输出',a);assert.ok(a>=0&&b>a);
  vm.runInNewContext(source.slice(a,b)+'\nglobalThis.goal=recordUserGoal;',f.context);f.context.goal('继续');assert.equal(f.context.state().rounds,0);
  const ds=source.slice(source.indexOf('    deepseek: {'),source.indexOf('      getSendBtn:',source.indexOf('    deepseek: {')));
  assert.ok(!ds.includes('recordUserGoal'));assert.ok(!ds.includes('consecutiveAutoDispatches'));
  const eng=source.slice(source.indexOf('    function executeEngAction('),source.indexOf('      if (action ===',source.indexOf('    function executeEngAction(')));assert.ok(!eng.includes('consecutiveAutoDispatches'));
});
test('page breaker switch only persists trusted user changes and honours cancelled opt-out',()=>{
  for(const approved of [true,false]){
    const f=fixture();const controls={checked:true},writes=[];
    const a=source.indexOf('    // 独立熔断设置：'),b=source.indexOf('    // 9. 设置项：自动发送延迟缓冲滑动条',a);
    Object.assign(f.context,{drawerEl:{querySelector:()=>({...controls,addEventListener:(type,fn)=>controls.change=fn})},confirm:()=>approved,GM_setValue:(...args)=>writes.push(args)});
    vm.runInNewContext(source.slice(a,b),f.context);controls.checked=false;controls.change({target:controls,isTrusted:false});assert.equal(controls.checked,true);assert.equal(writes.length,0);
    controls.checked=false;controls.change({target:controls,isTrusted:true});assert.equal(f.CONFIG.circuitBreaker,!approved);assert.equal(writes.length,approved?1:0);
    assert.equal(f.CONFIG.autoExecute,true);assert.equal(f.CONFIG.autoSend,false);
  }
});
test('defaults, cross-popup storage sync, diagnostic fields and independent checkbox are wired',()=>{
  assert.match(source,/circuitBreaker: GM_getValue\("webagent_circuit_breaker", true\) !== false/);
  assert.match(source,/maxConsecutiveSteps: Math.max\(20/);assert.match(source,/webagent_max_consecutive_steps", 20/);
  assert.ok(source.includes("if(key === 'webagent_circuit_breaker') setCircuitBreakerEnabled(change.newValue)"));
  assert.ok(source.includes('id="nexus-cfg-breaker"'));assert.ok(source.includes('toolCallRounds:consecutiveAutoDispatches'));
});
