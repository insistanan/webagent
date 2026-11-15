// Nexus local setup. No API key is needed for DeepSeek's website.

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const defaults = {webagent_auto_execute: false, webagent_auto_send: false, webagent_review_safe_mode: true,
    webagent_workspace_dir: '', webagent_project_id: '',
    webagent_bridge_url: 'http://127.0.0.1:8787', webagent_lb_token: '', webagent_management_token: ''};
  const items = await chrome.storage.local.get(defaults);
  $('autoExecuteToggle').checked = items.webagent_auto_execute;
  $('autoSendToggle').checked = items.webagent_auto_send;
  $('safeModeToggle').checked = items.webagent_review_safe_mode;
  $('workspacePathInput').value = items.webagent_workspace_dir;
  $('projectIdInput').value = items.webagent_project_id;
  $('bridgeUrlInput').value = items.webagent_bridge_url;
  $('bridgeTokenInput').value = items.webagent_lb_token;
  $('managementTokenInput').value = items.webagent_management_token;
  let activeAiTabId=null;
  async function checkPageVersion() {
    const notice=$('pageVersionStatus'),button=$('reloadPageBtn');
    button.disabled=true;
    if(!chrome.tabs?.query){notice.textContent='当前网页状态暂不可查询；扩展更新后请刷新 AI 页面。';return;}
    try {
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      const host=new URL(tab?.url||'about:blank').hostname;
      const sites=['gemini.google.com','deepseek.com','chatgpt.com','openai.com','kimi.ai','kimi.com','moonshot.cn','doubao.com','duck.ai','duckduckgo.com','qwen.ai','aliyun.com','dola.com'];
      if(!sites.some(site=>host===site||host.endsWith('.'+site))){notice.textContent='请在 Gemini / DeepSeek 等 AI 标签页打开扩展。';return;}
      activeAiTabId=tab.id;button.disabled=false;
      const page=await chrome.tabs.sendMessage(tab.id,{action:'webagent_page_status'});
      const installed=chrome.runtime.getManifest().version;
      if(!page || page.version!==installed){notice.textContent='扩展 '+installed+'；当前网页仍为旧脚本，请保存草稿后刷新。';return;}
      notice.textContent='网页 '+page.version+' · '+(page.connected?'MCP 在线':'MCP 未连接')+' · 自动发送'+(page.autoSend?'开启':'关闭');
      if(page.toolParse?.status==='incomplete')notice.textContent+=' · 最近 MCP JSON 被截断，未执行';
      if(page.toolParse?.status==='invalid')notice.textContent+=' · 最近 MCP JSON 格式错误，未执行';
      if(page.autoSendStatus)notice.textContent+=' · '+WebAgentAutoSend.describe(page.autoSendStatus);
    }catch{notice.textContent='当前网页仍是旧版或脚本已失效。扩展重载后，还需要刷新 Gemini / DeepSeek 页面。';}
  }
  $('reloadPageBtn').addEventListener('click',async event=>{
    if(!event.isTrusted || activeAiTabId===null)return;
    if(!confirm('请先保存发送栏中未提交的草稿。刷新会重新初始化工具监听。现在刷新当前 AI 网页？'))return;
    try{await chrome.tabs.reload(activeAiTabId);$('pageVersionStatus').textContent='网页刷新中，请稍后重新打开扩展检查版本。';}catch(error){$('pageVersionStatus').textContent=error.message;}
  });
  await checkPageVersion();
  $('managementTokenFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try {
      if(file.size>8192)throw new Error('令牌文件过大');
      const token=(await file.text()).trim();
      if(!token||/[\r\n\0]/.test(token))throw new Error('请选择仅包含管理令牌的文本文件');
      $('managementTokenInput').value=token;
      $('permissionNotice').textContent='管理令牌已填入；点击保存配置或应用权限。不会复制到网页输入框。';
    }catch(error){$('permissionNotice').textContent=error.message;}
    event.target.value='';
  });
  function settings() {
    const base = $('bridgeUrlInput').value.trim().replace(/\/+$/, '').replace(/\/mcp$/, '');
    if (!WebAgentMcp.localUrl(base + '/mcp')) throw new Error('只允许本地 8787 / 18080 / 21888 的 HTTP MCP 地址');
    return {webagent_auto_execute: $('autoExecuteToggle').checked, webagent_auto_send: $('autoSendToggle').checked,
      webagent_auto_retry_rate_limit: false, webagent_review_safe_mode: $('safeModeToggle').checked,
      webagent_workspace_dir: $('workspacePathInput').value.trim(),
      webagent_project_id: $('projectIdInput').value.trim(),
      webagent_bridge_url: base, webagent_lb_token: $('bridgeTokenInput').value.trim(),
      webagent_management_token: $('managementTokenInput').value.trim()};
  }
  async function checkProject(config) {
    const el = $('projectAccessStatus');
    el.textContent = '查询项目权限...';
    try {
      const info = await WebAgentProjectStatus.read(config);
      el.textContent = WebAgentProjectStatus.describe(info);
      $('projectAccessSelect').value = info.accessMode;
      if (['disabled','project-code'].includes(info.executionMode)) $('projectExecutionSelect').value = info.executionMode;
      return info;
    } catch (error) { el.textContent = error.message; return null; }
  }
  async function checkServices(config) {
    const badge = $('bridgeStatusBadge'), status = $('mcpBridgeStatus');
    badge.textContent = '检测 MCP...';
    const started = Date.now();
    try {
      const result = await WebAgentMcp.request({url: config.webagent_bridge_url + '/mcp', method: 'POST',
        token: config.webagent_lb_token, timeout: 5000, body: {jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}}});
      const tools = JSON.parse(result.responseText).result.tools;
      badge.textContent = '🟢 MCP 已连接'; badge.className = 'status-badge online';
      status.textContent = tools.length + ' 个顶层工具 · ' + (Date.now() - started) + 'ms';
      status.className = 'badge green';
      await checkProject(config);
    } catch (error) {
      badge.textContent = '🔴 MCP 未连接'; badge.className = 'status-badge offline';
      status.textContent = error.message; status.className = 'badge red';
    }
  }
  $('saveConfigBtn').addEventListener('click', async () => {
    try {
      const config = settings();
      if (config.webagent_auto_execute && !items.webagent_auto_execute &&
        !confirm('开启后，网页 AI 的工具提议将不经逐次确认直接执行，可能读写文件或运行命令。是否开启？工具结果是否自动发送由独立的“自动发送”开关决定。')) return;
      if (config.webagent_auto_send && !items.webagent_auto_send &&
        !confirm('开启后，工具结果及发送栏已有草稿将自动提交给当前网页 AI。确认开启自动发送？')) return;
      await chrome.storage.local.set(config); Object.assign(items, config);
      $('configNotice').textContent = '已保存；首次配置请刷新 DeepSeek / Gemini 页面。';
      await checkServices(config);
    } catch (error) { $('configNotice').textContent = error.message; }
  });
  $('checkConnectionBtn').addEventListener('click', () => {
    try { checkServices(settings()); } catch (error) { $('configNotice').textContent = error.message; }
  });
  async function applyPermission(setting,value,event) {
    if(!event.isTrusted) return;
    const notice=$('permissionNotice');
    const accessButton=$('applyAccessBtn'),executionButton=$('applyExecutionBtn');
    try {
      const config=settings();
      if(config.webagent_project_id!==items.webagent_project_id)throw new Error('项目 ID 已改动，请先保存配置再切换权限');
      if(!config.webagent_management_token)throw new Error('请先填写管理令牌；它只保存在扩展内，不发送给网页 AI');
      const effect=setting==='access'?(value==='read-only'?'设为文件只读，并关闭该项目的命令执行':'允许该项目文件读写'):
        (value==='project-code'?'允许在该项目上下文执行命令/脚本，同时将文件权限设为可读写；进程可能产生项目外副作用':'关闭该项目的命令执行');
      if(!confirm('项目：'+config.webagent_project_id+'\n目录：'+config.webagent_workspace_dir+'\n将'+effect+'。\n不会为 AI 授予修改权限设置的能力。确认应用？'))return;
      // Permission changes must not silently enable auto-execution or save unrelated controls.
      accessButton.disabled=true;executionButton.disabled=true;notice.textContent='应用中，请勿重复点击...';
      await chrome.storage.local.set({webagent_management_token:config.webagent_management_token});
      items.webagent_management_token=config.webagent_management_token;
      const response=await chrome.runtime.sendMessage({action:'set_project_permission',projectId:config.webagent_project_id,setting,value});
      if(!response?.success)throw new Error(response?.error||'权限变更失败，请检查实际状态');
      const info=await checkProject(config);
      notice.textContent=info?'已应用：'+WebAgentProjectStatus.describe(info):'管理接口已应用；MCP 状态暂未刷新，请检测连接';
    } catch(error) {
      notice.textContent=error.message;
      try {await checkProject(settings());}catch{}
    } finally {accessButton.disabled=false;executionButton.disabled=false;}
  }
  $('applyAccessBtn').addEventListener('click',event=>applyPermission('access',$('projectAccessSelect').value,event));
  $('applyExecutionBtn').addEventListener('click',event=>applyPermission('execution',$('projectExecutionSelect').value,event));
  $('injectPromptBtn').addEventListener('click', async () => {
    try {
      const config = settings(), fence = String.fromCharCode(96).repeat(3);
      const projectInfo = await checkProject(config);
      const text = [
        '你可以通过 WebAgent 提议调用本地 Nexus MCP；你不能直接访问本机。',
        '每次只输出一个 nexus 代码块，扩展根据用户开关逐次确认或自动执行、回填或自动发送。不得编造执行结果。',
        '格式：{"tool":"实际工具名","arguments":{}}',
        '长代码也必须是完整合法 JSON：content 中的换行、双引号和反斜杠按 JSON 字符串规则转义；不得省略、截断或用“...”代替源码。',
        "调用输出规范：只有确实需要工具时才输出一个 nexus 代码块；代码块内必须只有一个完整 JSON 对象，禁止说明文字、JSON 注释、尾逗号、JSON5 或多个调用。",
        "字段规范：tool 必须是已发现的真实工具名；arguments 必须是对象，字段和类型严格遵守工具 schema。文件源码只能放在 schema 指定的字符串字段（如 content），不得直接拼接裸 HTML/JS。",
        "字符串规范：换行编码为 \\n、回车为 \\r、制表符为 \\t；字符串内的双引号编码为 \\\"，反斜杠编码为 \\\\。禁止字符串内直接出现未转义真实换行；不要对整个 JSON 再次字符串化或双重转义。",
        "编码示例（仅展示字段，不是工具调用）：{\"content\":\"第一行\\n第二行：const title = \\\"番茄钟\\\";\"}",
        "完整性规范：不得用省略号、占位符或“其余不变”代替文件内容；若单次回复无法容纳完整调用，应先说明并规划按工具支持的分段写入方式进行，每次调用都必须独立完整，禁止输出半截 JSON。",
        "执行规范：输出调用后等待扩展返回真实结果；不要声称尚未执行的操作已经成功。任务完成后不再输出工具调用，直接自然语言总结。",
        '用户设置：自动执行='+config.webagent_auto_execute+'；自动发送工具结果='+config.webagent_auto_send+'。不要自行改变这些设置。',
        '项目 ID：' + config.webagent_project_id, '工作目录：' + config.webagent_workspace_dir,
        WebAgentProjectStatus.prompt(projectInfo),
        '文件路径使用项目内相对路径。未经授权不要读取凭证、写文件、删文件或运行命令。',
        '首先只读验证项目：', fence + 'nexus',
        JSON.stringify({tool:'nexus_project_info',arguments:{projectId:config.webagent_project_id}}), fence,
        '其他工具先用 nexus_discover_tools 查询实际名称及参数。任务完成后停止调用。'
      ].join('\n');
      await navigator.clipboard.writeText(text);
      $('configNotice').textContent = projectInfo ? '协议和实时项目权限已复制。请自行粘贴到 Gemini / DeepSeek，不包含令牌。' : '协议已复制，但权限查询失败；请先检测连接并重新查询。';
    } catch (error) { $('configNotice').textContent = error.message; }
  });
  await checkServices(items);
});
