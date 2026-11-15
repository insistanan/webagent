// Live read-only project status. Never grants permissions or executes commands.
(function(root) {
  'use strict';
  function extract(result) {
    if (result?.isError) throw new Error('项目权限查询失败');
    let info = result?.structuredContent;
    if (!info?.accessMode) {
      for (const item of result?.content || []) {
        if (item.type !== 'text') continue;
        try { const candidate = JSON.parse(item.text); if (candidate?.accessMode) {info = candidate;break;} } catch {}
      }
    }
    if (!info || !['read-only','read-write'].includes(info.accessMode)) throw new Error('未获得有效项目权限，不能推断为只读或可写');
    return {id: info.id || info.projectId, name: info.name || '', accessMode: info.accessMode,
      executionMode: info.executionMode || 'unknown', enabled: info.enabled};
  }
  function describe(info) {
    if (!info) return '项目权限未查询';
    return (info.accessMode === 'read-write' ? '文件可读写' : '文件只读') + ' · ' +
      (info.executionMode === 'disabled' ? '命令执行关闭' : info.executionMode === 'project-code' ? '项目代码执行启用' : '执行权限未知');
  }
  function prompt(info) {
    if (!info) return '项目权限尚未查询。先调用 nexus_project_info 获取实际 accessMode / executionMode，不要凭旧对话猜测。';
    return '实时查询的项目权限：accessMode=' + info.accessMode + '；executionMode=' + info.executionMode +
      '。文件读写与命令执行是独立权限；executionMode=disabled 不代表文件只读。不要尝试自行切换权限；如操作被拒绝，重新查询 nexus_project_info，按真实错误提示用户。';
  }
  async function read(config, client = root.WebAgentMcp) {
    if (!config.webagent_project_id) throw new Error('请先填写项目 ID');
    const response = await client.request({url:config.webagent_bridge_url.replace(/\/+$/, '')+'/mcp',
      method:'POST', token:config.webagent_lb_token || '', timeout:5000,
      body:{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'nexus_project_info',arguments:{projectId:config.webagent_project_id}}}});
    const info=extract(JSON.parse(response.responseText).result);
    if (info.id && info.id !== config.webagent_project_id) throw new Error('返回的项目 ID 与配置不一致');
    return info;
  }
  const api={extract,describe,prompt,read};
  if(typeof module==='object' && module.exports)module.exports=api;else root.WebAgentProjectStatus=api;
})(globalThis);
