const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {build}=require('../command-request.js');
const config={projectId:'proj-test'};
const command=(tool,args)=>build(tool,args,config).arguments.arguments;
test('command aliases use native project command tool, never a global script',()=>{
  for(const name of ['command_run','localbridge_command_run','nexus_command_run','exec']) {
    const req=build(name,{command:'node --version'},config);
    assert.equal(req.name,'nexus_execute_action');assert.equal(req.arguments.tool,'localbridge_command_run');
    assert.deepEqual(req.arguments.arguments,{kind:'shell-command',projectId:'proj-test',cwd:'.',command:'node --version'});
  }
});
test('explicit shell aliases and PowerShell command inference are preserved',()=>{
  assert.equal(command('powershell',{command:'Write-Output test'}).shell,'powershell');
  assert.equal(command('cmd',{command:'echo test'}).shell,'cmd');
  assert.equal(command('command_run',{cmd:'Get-Location'}).shell,'powershell');
  assert.equal(command('command_run',{command:'Get-Location',shell:'pwsh'}).shell,'pwsh');
});
test('rejects absent project, empty command, invalid kind or non-object arguments',()=>{
  assert.throws(()=>build('exec',{command:'echo test'},{}),/项目 ID/);
  assert.throws(()=>command('exec',{}),/为空/);
  assert.throws(()=>command('exec',{command:'  '}),/为空/);
  assert.throws(()=>command('exec',{kind:'constructor'}),/未知/);
  assert.throws(()=>command('exec',[]),/对象/);
});
test('preserves native argument arrays and allowed execution fields',()=>{
  const args=['--flag','value'];
  assert.deepEqual(command('exec',{command:'node',args,cwd:'subdir',env:{A:'B'},timeoutMs:2000,approvalId:'approved',unknown:true}),
    {kind:'shell-command',projectId:'proj-test',command:'node',args,cwd:'subdir',env:{A:'B'},timeoutMs:2000,approvalId:'approved'});
});
test('script kinds only forward fields accepted by strict Nexus schema',()=>{
  for(const kind of ['node-script','python-script'])assert.deepEqual(command('command_run',{kind,path:'a.js',args:['one'],env:{X:'Y'},shell:'cmd'}),
    {kind,projectId:'proj-test',cwd:'.',path:'a.js',args:['one']});
  assert.deepEqual(command('command_run',{kind:'package-script',manager:'npm',script:'test',args:['--run'],command:'ignored'}),
    {kind:'package-script',projectId:'proj-test',cwd:'.',manager:'npm',script:'test',args:['--run']});
});
test('tool-version never includes cwd, args or timeoutMs',()=>{
  assert.deepEqual(command('command_run',{kind:'tool-version',tool:'node',cwd:'bad',args:['bad'],timeoutMs:2000,callerPurpose:'check'}),
    {kind:'tool-version',projectId:'proj-test',tool:'node',callerPurpose:'check'});
});
test('content integration loads helper, retains argument arrays and has no old command execSync',()=>{
  const source=fs.readFileSync(require.resolve('../content.js'),'utf8');
  const a=source.indexOf('const request=WebAgentCommandRequest.build');
  const b=source.indexOf('cleanTool.startsWith("android_")',a);
  assert.ok(a>0&&b>a);assert.ok(!source.slice(a,b).includes('execSync'));
  assert.ok(source.includes('!Array.isArray(args.args)'));
  const manifest=require('../manifest.json');
  assert.ok(manifest.content_scripts[0].js.indexOf('command-request.js')<manifest.content_scripts[0].js.indexOf('content.js'));
});
