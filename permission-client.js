// Narrow management controls: invoked only from the extension's own popup.
(function(root) {
  'use strict';
  const allowed={access:new Set(['read-only','read-write']),execution:new Set(['disabled','project-code'])};
  function trustedPopup(sender,runtime) {
    return sender?.id===runtime.id && sender.url===runtime.getURL('popup.html') && !sender.tab;
  }
  function validate(request,settings) {
    if(!request || !allowed[request.setting]?.has(request.value))throw new Error('不支持的项目权限设置');
    if(!request.projectId || request.projectId!==settings.webagent_project_id)throw new Error('只能修改扩展当前已保存的项目，请先保存项目配置');
    if(!settings.webagent_management_token)throw new Error('请先在扩展弹窗配置 Nexus 管理令牌（与 Bridge Token 不同）');
    return {url:'http://127.0.0.1:18080/api/management/projects/'+encodeURIComponent(request.projectId)+'/'+request.setting,
      body:request.setting==='access'?{accessMode:request.value}:{executionMode:request.value}};
  }
  async function change(request,settings,fetcher=fetch) {
    const target=validate(request,settings);
    const token=settings.webagent_management_token;
    async function call(url,options={}) {
      const response=await fetcher(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error(response.status===401?'管理令牌无效；不能用 Bridge Token 代替':'Nexus 权限接口 HTTP '+response.status);
      return response.json();
    }
    const before=await call('http://127.0.0.1:18080/api/projects');
    if(!before.projects?.some(p=>p.id===request.projectId))throw new Error('Nexus 未登记该项目，未修改权限');
    await call(target.url,{method:'POST',body:JSON.stringify(target.body)});
    // Verify server state after mutation. Do not replay a failed or timed-out mutation.
    const after=await call('http://127.0.0.1:18080/api/projects');
    const p=after.projects?.find(p=>p.id===request.projectId);
    const field=request.setting==='access'?'accessMode':'executionMode';
    if(!p || p[field]!==request.value)throw new Error('权限变更后的状态不一致，请刷新检查');
    return {id:p.id,name:p.name,enabled:p.enabled,accessMode:p.accessMode,executionMode:p.executionMode};
  }
  const api={trustedPopup,validate,change};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WebAgentPermissionClient=api;
})(globalThis);
