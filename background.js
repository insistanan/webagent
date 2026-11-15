// WebAgent local MCP proxy. Credentials never enter website storage.
importScripts('mcp-client.js','permission-client.js');
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({text: 'ON'});
  chrome.action.setBadgeBackgroundColor({color: '#10b981'});
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || sender.id !== chrome.runtime.id) return false;
  if (request.action === 'set_project_permission') {
    if (!WebAgentPermissionClient.trustedPopup(sender, chrome.runtime)) {
      sendResponse({success:false,error:'权限设置只能从浏览器扩展弹窗修改，网页 AI 没有管理权限'});
      return false;
    }
    (async () => {
      const settings=await chrome.storage.local.get({webagent_project_id:'',webagent_management_token:''});
      return WebAgentPermissionClient.change(request,settings);
    })().then(project=>sendResponse({success:true,project})).catch(error=>sendResponse({success:false,
      error:error.name==='TimeoutError'||error.name==='AbortError'?'请求超时，请刷新实际权限后再决定是否重试':error.message}));
    return true;
  }
  if (request.action === 'fetch_bridge') {
    (async () => {
      const url = WebAgentMcp.localUrl(request.url);
      if (!url) throw new Error('Only approved local MCP endpoints are allowed');
      const settings = await chrome.storage.local.get({webagent_lb_token: '', webagent_bridge_url: 'http://127.0.0.1:8787'});
      const configured = WebAgentMcp.localUrl(settings.webagent_bridge_url.replace(/\/+$/, '') + '/mcp');
      // Do not disclose a Nexus token to unrelated local services.
      const token = configured && url.origin === configured.origin ? settings.webagent_lb_token : '';
      return WebAgentMcp.request({url: url.href, method: request.method, body: request.body,
        timeout: request.timeout, token});
    })().then(result => sendResponse(result)).catch(error => sendResponse({success: false,
      error: error.name === 'AbortError' ? 'Local MCP request timed out' : error.message}));
    return true;
  }
  if (request.action === 'update_badge') {
    if (request.text !== undefined) chrome.action.setBadgeText({text: String(request.text).slice(0, 4)});
    if (request.color) chrome.action.setBadgeBackgroundColor({color: request.color});
    sendResponse({success: true});
  }
  return false;
});
