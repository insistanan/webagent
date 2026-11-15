// Map aliases to Nexus's project-scoped command tool, not global execSync.
(function(root) {
  'use strict';
  const fields={
    'shell-command':['command','args','cwd','env','shell','timeoutMs','approvalId','sessionId','callerPurpose'],
    'node-script':['path','args','cwd','timeoutMs','approvalId','sessionId','callerPurpose'],
    'python-script':['path','args','cwd','timeoutMs','approvalId','sessionId','callerPurpose'],
    'package-script':['manager','script','args','cwd','timeoutMs','approvalId','sessionId','callerPurpose'],
    'tool-version':['tool','approvalId','sessionId','callerPurpose']
  };
  function build(toolName,args={},config={}) {
    if(!args || typeof args!=='object' || Array.isArray(args))throw new Error('命令参数必须是对象');
    const kind=args.kind||'shell-command';
    if(!Object.hasOwn(fields,kind))throw new Error('未知的 Nexus 命令类型，请先发现工具参数');
    const projectId=args.projectId||config.projectId;
    if(typeof projectId!=='string'||!projectId.trim())throw new Error('执行命令需要已配置的项目 ID');
    const command={kind,projectId};
    if(kind!=='tool-version')command.cwd=args.cwd||'.';
    for(const key of fields[kind])if(args[key]!==undefined)command[key]=args[key];
    if(kind==='shell-command') {
      command.command=args.command||args.cmd||args.exec||args.script||args.code||'';
      if(typeof command.command!=='string'||!command.command.trim())throw new Error('命令内容为空');
      const clean=toolName.replace(/^localbridge_|^nexus_/,'').toLowerCase();
      if(!command.shell && clean==='cmd')command.shell='cmd';
      if(!command.shell && (clean==='powershell'||/^\s*(?:Get-|Set-|New-|Remove-|Copy-|Move-|Start-Process|\$)/i.test(command.command)))command.shell='powershell';
    }
    return {name:'nexus_execute_action',arguments:{tool:'localbridge_command_run',arguments:command}};
  }
  const api={build};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WebAgentCommandRequest=api;
})(globalThis);
