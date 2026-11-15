const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {writeToDraft} = require('../draft-output.js');
function fixture(initial = '') {
  const input = {value: initial, isConnected: true, getAttribute: () => null};
  const writes = [];
  const adapter = {getInput: () => input, isGenerating: () => false,
    setValue(el, value) {writes.push(value); el.value = value;},
    getSendBtn() {throw new Error('Send must not be queried');}};
  return {input, writes, adapter};
}
test('fills an empty send field immediately without Send or Enter', async () => {
  const f = fixture(); const result = await writeToDraft(f.adapter, '【本地结果】完成');
  assert.equal(f.input.value, '【本地结果】完成'); assert.equal(result.written, true);
  assert.equal(f.writes.length, 1);
});
test('preserves and appends to an existing draft instead of replacing it', async () => {
  const f = fixture('我的原草稿\n第二行  ');
  const result = await writeToDraft(f.adapter, '【本地结果】完成');
  assert.equal(f.input.value, '我的原草稿\n第二行  \n\n【本地结果】完成');
  assert.equal(result.appended, true);
});
test('rich-text drafts use innerText to preserve paragraph boundaries', async () => {
  const f = fixture(); delete f.input.value; f.input.innerText = '第一段\n第二段'; f.input.textContent = '第一段第二段';
  await writeToDraft(f.adapter, '结果'); assert.equal(f.writes[0], '第一段\n第二段\n\n结果');
});
test('already present results are not inserted twice', async () => {
  const f = fixture('草稿\n\n工具结果');
  assert.equal((await writeToDraft(f.adapter, '工具结果')).alreadyPresent, true);
  assert.equal(f.writes.length, 0);
});
test('waits for generation/input readiness and uses the current input', async () => {
  const f = fixture('保留'); let ticks = 0, clock = 0;
  f.adapter.getInput = () => ticks ? f.input : null;
  f.adapter.isGenerating = () => ticks < 2;
  await writeToDraft(f.adapter, '结果', {timeoutMs:1000, now:()=>clock, wait:async ms=>{ticks++;clock+=ms;}});
  assert.equal(ticks, 2); assert.equal(f.input.value, '保留\n\n结果');
});
test('does not touch disabled, detached, or read-only fields', async () => {
  for(const blocker of ['disabled','readOnly','isConnected']) {
    const f = fixture('原草稿'); f.input[blocker] = blocker === 'isConnected' ? false : true;
    await assert.rejects(writeToDraft(f.adapter, '结果', {timeoutMs:0}), /暂不可用/);
    assert.equal(f.input.value, '原草稿'); assert.equal(f.writes.length, 0);
  }
});
test('bounds waits and rejects empty results', async () => {
  const f = fixture(); let clock = 0; f.adapter.getInput = () => null;
  await assert.rejects(writeToDraft(f.adapter, '结果', {timeoutMs:500, now:()=>clock,wait:async ms=>{clock+=ms;}}), /暂不可用/);
  assert.equal(clock,500); await assert.rejects(writeToDraft(f.adapter, ''), /为空/);
});
function dispatchFixture() {
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const start=source.indexOf('  // Results go directly to the input.');
  const end=source.indexOf('\n  function checkAndHandleRateLimitError()',start);
  const f=fixture(); const notices=[]; const copies=[];
  const context={WebAgentDraftOutput:{writeToDraft},currentAdapter:f.adapter,latestFeedbackText:'',countdownTimer:null,
    extensionContextInvalid:false,extensionContextAlive:()=>true,CONFIG:{autoSend:false},location:{href:'https://gemini.google.com/app/test'},
    showToast:text=>notices.push(text),webagentOfferResultCopy:text=>copies.push(text)};
  vm.createContext(context); vm.runInContext(source.slice(start,end)+'\nglobalThis.dispatch=safeDispatchFeedbackToChat;globalThis.finished=()=>draftWriteQueue;',context);
  return {...f,context,notices,copies};
}
test('content script queues results and writes directly with no result modal', async () => {
  const f=dispatchFixture(); f.context.dispatch('结果 A','a'); f.context.dispatch('结果 B','b');
  await f.context.finished(); assert.equal(f.input.value,'结果 A\n\n结果 B'); assert.equal(f.copies.length,0);
  assert.equal(f.writes.length,2);
});
test('failed draft write offers copy and does not poison later results', async () => {
  const f=dispatchFixture(); let fail=true;
  f.adapter.setValue=(input,value)=>{if(fail){fail=false;throw new Error('render failed');}input.value=value;};
  f.context.dispatch('结果 A','a'); f.context.dispatch('结果 B','b'); await f.context.finished();
  assert.deepEqual(f.copies,['结果 A']); assert.equal(f.input.value,'结果 B');
});
class Element {
  constructor(tag) {this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.style={};}
  append(...els) {for(const el of els){el.parent=this;this.children.push(el);}}
  appendChild(el) {this.append(el);return el;}
  insertBefore(el,before) {el.parent=this;this.children.splice(this.children.indexOf(before),0,el);}
  attachShadow() {this.shadow=new Element('shadow');return this.shadow;}
  setAttribute(k,v) {this.attributes[k]=v;}
  addEventListener(type,fn) {(this.listeners[type]??=[]).push(fn);}
  fire(type,event={}) {for(const fn of this.listeners[type]||[])fn(event);}
  remove() {if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this);}
  querySelector(tag) {for(const el of this.children){if(el.tag===tag)return el;const match=el.querySelector(tag);if(match)return match;}return null;}
}
function reviewFixture() {
  const body=new Element('body');
  const context={document:{body,createElement:tag=>new Element(tag),getElementById:id=>body.children.find(el=>el.id===id)},navigator:{clipboard:{writeText:async()=>{}}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../review-ui.js'),'utf8'),context);
  return {body,context};
}
test('approval uses a non-blocking corner card and lazily renders parameters', async () => {
  const f=reviewFixture();const pending=f.context.webagentReviewTool({tool:'nexus_file_read',args:{path:'README.md'}});
  const host=f.body.children[0];assert.ok(!host.style.cssText.includes('inset:0'));assert.ok(!host.style.cssText.includes('background:#0009'));
  const details=host.shadow.querySelector('details');assert.equal(details.querySelector('pre'),null);
  details.open=true;details.fire('toggle');assert.ok(details.querySelector('pre').textContent.includes('README.md'));
  const nav=host.shadow.querySelector('nav');nav.children[1].fire('click',{isTrusted:true});assert.equal(await pending,true);
  assert.equal(f.body.children.length,0);
});
test('synthetic approval remains rejected; a trusted cancel resolves false',async()=>{
  const f=reviewFixture();const pending=f.context.webagentReviewTool({tool:'example',args:{}});
  const nav=f.body.children[0].shadow.querySelector('nav');let done=false;pending.then(()=>done=true);
  nav.children[1].fire('click',{isTrusted:false});await Promise.resolve();assert.equal(done,false);
  nav.children[0].fire('click',{isTrusted:true});assert.equal(await pending,false);
  assert.equal(typeof f.context.webagentPresentResult,'undefined');
});
