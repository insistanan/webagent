const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const parser=require('../tool-json.js');
const tool='localbridge_file_create';
const make=content=>({tool,arguments:{projectId:'test-project',path:'test/index.html',content}});
const invalidMultiline=content=>JSON.stringify(make(content)).replace(/\\n/g,'\n');

test('valid long HTML is returned byte-for-byte, without truncation',()=>{
  const content='<html>\n'+('中文 😀 <script>const x={a:"\\n",b:"},]"};</script>\n'.repeat(18000))+'</html>';
  const result=parser.inspect(JSON.stringify(make(content)));
  assert.equal(result.status,'parsed');assert.equal(result.call.args.content,content);
  assert.deepEqual(result.repairs,{controls:0,slashes:0,commas:0});
});
test('real newlines in a long HTML JSON string are escaped, not removed',()=>{
  const content='<html>\n'+('  <div class="timer">番茄钟 { } 😀</div>\n'.repeat(900))+'</html>';
  const result=parser.inspect(invalidMultiline(content));
  assert.equal(result.status,'parsed');assert.equal(result.call.tool,tool);
  assert.equal(result.call.args.content,content);assert.equal(result.repairs.controls,901);
});
test('all raw JSON string control characters preserve their exact value',()=>{
  const content=Array.from({length:32},(_,i)=>String.fromCharCode(i)).join('');
  const raw='{"tool":"file_write","arguments":{"content":"'+content+'"}}';
  const result=parser.inspect(raw);assert.equal(result.call.args.content,content);assert.equal(result.repairs.controls,32);
});
test('legal escapes, escaped quotes, unicode, braces and double slashes never change',()=>{
  const content='quote " braces {} [ ] slash \\ literal \\n \\t \\u4e2d actual\tCR\r\n中文😀';
  const raw=JSON.stringify(make(content));
  assert.equal(parser.inspect(raw).call.args.content,content);
  assert.equal(parser.repairJson(raw).json,raw);
});
test('literal slash before a raw newline is retained',()=>{
  const raw='{"tool":"file_write","arguments":{"content":"a'+String.fromCharCode(92)+'\nb"}}';
  assert.equal(parser.inspect(raw).call.args.content,'a\\\nb');
});
test('isolated invalid backslash repair and trailing comma support stay string-aware',()=>{
  const raw='{"tool":"file_write","arguments":{"content":"C:'+String.fromCharCode(92)+'project ,} ,]","list":[1,2,],},}';
  const result=parser.inspect(raw);assert.equal(result.status,'parsed');
  assert.equal(result.call.args.content,'C:\\project ,} ,]');assert.deepEqual(result.call.args.list,[1,2]);
  assert.equal(result.repairs.commas,3);
});
test('formatted outer JSON whitespace remains structural whitespace',()=>{
  const content='a\nb';const raw=JSON.stringify(make(content),null,2).replace(/\\n/g,'\n');
  const result=parser.inspect(raw);assert.equal(result.call.args.content,content);assert.equal(result.repairs.controls,1);
});
test('text prefix, suffix and multiple closed non-tool objects do not corrupt payload',()=>{
  const content='a\nb {}';const raw='说明 {"example":1} 代码段 '+invalidMultiline(content)+' 按钮';
  assert.equal(parser.inspect(raw).call.args.content,content);
});
test('missing final brace or missing closing string never guesses or runs nested data',()=>{
  for(const raw of [JSON.stringify(make('x')).slice(0,-1),'{"tool":"file_write","arguments":{"content":"unfinished',
    '{"tool":"file_write","arguments":{"nested":{"tool":"command_run","command":"danger"}}']) {
    assert.equal(parser.inspect(raw).status,'incomplete');assert.equal(parser.inspect(raw).call,null);
  }
});
test('unescaped embedded quotes and invalid unicode escapes require model correction',()=>{
  for(const raw of ['{"tool":"file_write","arguments":{"content":"<div class="timer">"}}',
    '{"tool":"file_write","arguments":{"content":"'+String.fromCharCode(92)+'uXYZW"}}']) {
    assert.equal(parser.inspect(raw).status,'invalid');assert.equal(parser.inspect(raw).call,null);
  }
});
test('ordinary app data, nested tool examples and unknown name/action are not commands',()=>{
  for(const obj of [{name:'timer',content:'hi'},{action:'startTimer'},{example:{tool:'file_write',arguments:{}}},
    {content:'{"tool":"command_run","arguments":{}}'}])assert.equal(parser.inspect(JSON.stringify(obj)).call,null);
  assert.equal(parser.inspect('{"name":"file_read","path":"a"}',{isKnownTool:name=>name==='file_read'}).call.tool,'file_read');
});
test('tool aliases, args and flat arguments are compatible',()=>{
  for(const key of ['tool','tool_name','function'])assert.deepEqual(parser.inspect(JSON.stringify({[key]:'file_read',args:{path:'a'}})).call,{tool:'file_read',args:{path:'a'}});
  assert.deepEqual(parser.inspect('{"tool":"file_read","path":"a"}').call,{tool:'file_read',args:{path:'a'}});
});
function contentParser(source=fs.readFileSync(require.resolve('../content.js'),'utf8')){
  // Git may check out CRLF on Windows; fixture extraction must accept both.
  source=source.replace(/\r\n/g,'\n');
  const start=source.indexOf('  let lastToolParseStatus');
  const end=source.indexOf('  // =========================================================================\n  // 8.5 ',start);
  assert.ok(start>=0 && end>start,'content parser fixture boundaries must exist');
  const context={WebAgentToolJson:parser,isLikelyValidTool:()=>false};
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.parse=parseToolCallFromReply;globalThis.status=()=>lastToolParseStatus;',context);
  return context;
}
test('content parser extraction supports both LF and Windows CRLF checkouts',()=>{
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8').replace(/\r\n/g,'\n');
  for(const fixture of [source,source.replace(/\n/g,'\r\n')]) {
    const p=contentParser(fixture);
    const raw=JSON.stringify(make('first\nlast'));
    assert.equal(p.parse(raw,null).args.content,'first\nlast');
    assert.equal(p.status().status,'parsed');
  }
});
test('Gemini DOM code extraction parses full malformed multiline file_create',()=>{
  const p=contentParser(),content=('div { x }\n'.repeat(2500));
  const block={matches:()=>true,textContent:invalidMultiline(content),closest:()=>null};
  const node={matches:()=>false,querySelectorAll:()=>[block]};
  const call=p.parse('代码段',node);assert.equal(call.tool,tool);assert.equal(call.args.content,content);
  assert.equal(p.status().status,'parsed');
});
test('fenced MCP and plain text fallback use the same lossless repair',()=>{
  const p=contentParser(),raw=invalidMultiline('first\nlast');const fence=String.fromCharCode(96).repeat(3);
  for(const text of [fence+'mcp\n'+raw+'\n'+fence,'说明 '+raw])assert.equal(p.parse(text,null).args.content,'first\nlast');
});
test('thought code is excluded and invalid/incomplete commands report metadata only',()=>{
  const p=contentParser(),raw=invalidMultiline('first\nlast');
  const block={matches:()=>true,textContent:raw,closest:()=>({})};
  assert.equal(p.parse('reasoning',{matches:()=>false,querySelectorAll:()=>[block]}),null);
  assert.equal(p.parse(JSON.stringify(make('secret')).slice(0,-1),null),null);
  assert.equal(p.status().status,'incomplete');assert.equal(JSON.stringify(p.status()).includes('secret'),false);
});
test('the shared parser loads before content.js in the extension',()=>{
  const manifest=JSON.parse(fs.readFileSync(require.resolve('../manifest.json'),'utf8'));
  const scripts=manifest.content_scripts[0].js;assert.ok(scripts.indexOf('tool-json.js')>=0);assert.ok(scripts.indexOf('tool-json.js')<scripts.indexOf('content.js'));
});

test('both collaboration prompts require full JSON strings and respect user automation switches',()=>{
  const content=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const start=content.indexOf('  function getCustomAgentPrompt()');const end=content.indexOf('  // =========================================================================',start);
  const context={CONFIG:{autoExecute:true,autoSend:true,projectId:'test',workspace:'test'}};
  vm.runInNewContext(content.slice(start,end)+'\nglobalThis.prompt=getCustomAgentPrompt();',context);
  assert.match(context.prompt,/自动执行=true；自动发送工具结果=true/);assert.match(context.prompt,/不得省略、截断/);
  const popup=fs.readFileSync(require.resolve('../popup.js'),'utf8');assert.match(popup,/content 中的换行、双引号和反斜杠/);
});

test('format rules show valid escaped JSON and disallow mixed or incomplete calls',()=>{
  const content=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const start=content.indexOf('  function getCustomAgentPrompt()');const end=content.indexOf('  // =========================================================================',start);
  const context={CONFIG:{autoExecute:true,autoSend:true,projectId:'test',workspace:'test'}};
  vm.runInNewContext(content.slice(start,end)+'\nglobalThis.prompt=getCustomAgentPrompt();',context);
  const example=context.prompt.split('\n').find(line=>line.startsWith('编码示例')).split('：').slice(1).join('：');
  assert.equal(JSON.parse(example).content,'第一行\n第二行：const title = "番茄钟";');
  assert.match(context.prompt,/代码块内必须只有一个完整 JSON 对象/);
  assert.match(context.prompt,/禁止输出半截 JSON/);assert.match(context.prompt,/不得直接拼接裸 HTML\/JS/);
  assert.match(context.prompt,/不要对整个 JSON 再次字符串化或双重转义/);
  assert.match(context.prompt,/任务完成后不再输出工具调用/);
});
