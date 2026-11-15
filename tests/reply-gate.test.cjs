const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../reply-gate.js');
test('reload skips initial stable history even if it contains tool JSON',()=>{const gate=create();assert.equal(gate.accept('/a','old tool'),false);assert.equal(gate.accept('/a','old tool'),false);});
test('first actual submission in empty chat is accepted, not lost to hydration gate',()=>{const gate=create();gate.route('/a');gate.submit('/a');assert.equal(gate.accept('/a','new tool'),true);assert.equal(gate.accept('/a','new tool'),false);});
test('new replies after hydrated history are accepted once',()=>{const gate=create();gate.accept('/a','old tool');gate.submit('/a');assert.equal(gate.accept('/a','new tool'),true);assert.equal(gate.accept('/a','new tool'),false);});
test('route changes skip another conversation history but allow its next reply',()=>{const gate=create();gate.accept('/a','old');gate.accept('/a','new');assert.equal(gate.accept('/b','other history'),false);gate.submit('/b');assert.equal(gate.accept('/b','other new'),true);});
test('empty initialization does not consume baseline before delayed history hydration',()=>{const gate=create();assert.equal(gate.accept('/a',''),false);assert.equal(gate.accept('/a','delayed history'),false);});

test('late history rendering changes never execute without a new submit',()=>{const gate=create();assert.equal(gate.accept('/a','partial history'),false);assert.equal(gate.accept('/a','full tool history'),false);assert.equal(gate.accept('/a','expanded full tool history'),false);gate.submit('/a');assert.equal(gate.accept('/a','fresh tool response'),true);});

test('early submit snapshots old response so pre-generation ticks cannot replay it',()=>{const gate=create();gate.route('/a');gate.submit('/a','old tool');assert.equal(gate.accept('/a','old tool'),false);assert.equal(gate.accept('/a','new tool'),true);});

test('explicit regenerate accepts a changed reply once without replaying the old baseline',()=>{const gate=create();gate.accept('/a','old');gate.submit('/a','old');assert.equal(gate.accept('/a','old'),false);assert.equal(gate.accept('/a','regenerated'),true);assert.equal(gate.accept('/a','regenerated'),false);});
test('browsing previous/next versions cancels any armed submission',()=>{const gate=create();gate.accept('/a','old');gate.submit('/a','old');gate.cancel('/a','old');assert.equal(gate.accept('/a','historical version'),false);gate.submit('/a','historical version');assert.equal(gate.accept('/a','new reply'),true);});

test('new Gemini conversation route keeps the submitted first reply only after matching its user bubble',()=>{
  let match=null;
  const gate=create({canContinueRoute:(a,b)=>a==='/app'&&b==='/app/new',matchesContinuedSubmission:()=>match});
  gate.submit('/app','');gate.route('/app/new');assert.equal(gate.accept('/app/new','tool'),false);
  match=true;assert.equal(gate.accept('/app/new','tool'),true);assert.equal(gate.accept('/app/new','tool'),false);
});
test('navigating to existing history or a mismatched user bubble never continues an old submission',()=>{
  for(const matches of [false,undefined]) {
    const gate=create({canContinueRoute:()=>true,matchesContinuedSubmission:()=>matches});
    gate.submit('/app','');gate.route('/app/history');assert.equal(gate.accept('/app/history','old tool'),false);
  }
  const gate=create({canContinueRoute:()=>false,matchesContinuedSubmission:()=>true});
  gate.submit('/app/a','old');gate.route('/app/b');assert.equal(gate.accept('/app/b','historical tool'),false);
});
test('reload alone cannot arm new-conversation migration or delayed history',()=>{
  const gate=create({canContinueRoute:()=>true,matchesContinuedSubmission:()=>true});
  gate.route('/app');gate.route('/app/new');assert.equal(gate.accept('/app/new','old tool'),false);
});
