const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
function fixture(){
  const pill={},status={},root={querySelector:selector=>selector==='.nexus-pill-text'?pill:status};
  const chrome={runtime:{id:'test-id'}};const context={chrome,document:{querySelector:()=>root}};
  const start=source.indexOf('  // Extension reload does not replace');const end=source.indexOf('  // 0. Universal GM API',start);
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.alive=extensionContextAlive;globalThis.expired=showExtensionRefreshNeeded;globalThis.invalid=()=>extensionContextInvalid;',context);
  return {chrome,context,pill,status};
}
test('invalidated extension context shows explicit refresh status, not generic permission error',()=>{
  const f=fixture();assert.equal(f.context.alive(),true);assert.equal(f.context.expired(new Error('ordinary tool failure')),false);
  f.chrome.runtime.id=undefined;assert.equal(f.context.alive(),false);assert.equal(f.context.expired(),true);assert.equal(f.context.invalid(),true);
  assert.match(f.pill.textContent,/已更新.*刷新网页/);assert.match(f.status.textContent,/脚本已失效/);
});
test('content monitor stops after context invalidation and diagnostics never return credentials',()=>{
  assert.ok(source.includes('clearInterval(loopTimer);return;'));assert.ok(source.includes('if(extensionContextInvalid){showExtensionRefreshNeeded();return;}'));
  const a=source.indexOf('// Read-only popup diagnostics:');const b=source.indexOf('// 10. 初始化启动',a);const code=source.slice(a,b);
  assert.ok(code.includes('webagent_page_status'));assert.ok(!/token|management/i.test(code));assert.ok(source.includes('enabled: () => CONFIG.autoSend && !extensionContextInvalid && extensionContextAlive()'));
});
