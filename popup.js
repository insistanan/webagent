// WebAgent 1.3.3 - Popup Controller
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  chrome.storage.local.get({
    webagent_auto_execute: true,
    webagent_auto_retry_rate_limit: true,
    webagent_review_safe_mode: true,
    webagent_workspace_dir: '',
        webagent_bridge_url: 'http://127.0.0.1:18080'
  }, (items) => {
    $('autoExecuteToggle').checked = items.webagent_auto_execute;
    $('autoRetryToggle').checked = items.webagent_auto_retry_rate_limit;
    $('safeModeToggle').checked = items.webagent_review_safe_mode;
    $('workspacePathInput').value = items.webagent_workspace_dir || '';  });

  $('saveConfigBtn').addEventListener('click', () => {
    const newConfig = {
      webagent_auto_execute: $('autoExecuteToggle').checked,
      webagent_auto_retry_rate_limit: $('autoRetryToggle').checked,
      webagent_review_safe_mode: $('safeModeToggle').checked,
      webagent_workspace_dir: $('workspacePathInput').value.trim()
    };
    chrome.storage.local.set(newConfig, () => {
      const btn = $('saveConfigBtn');
      const oldText = btn.textContent;
      btn.textContent = '✅ Saved';
      setTimeout(() => { btn.textContent = oldText; }, 1500);
    });
  });

  async function checkServices() {
    let bridgeOk = false;
    let bridgePing = 0;

    const start = Date.now();
    try {
      const res = await fetch('http://127.0.0.1:18080/health', { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        bridgeOk = true;
        bridgePing = Date.now() - start;
      }
    } catch(e) {}

    const badge = $('bridgeStatusBadge');
    if (bridgeOk) {
      badge.textContent = '🟢 Online (' + bridgePing + 'ms)';
      badge.className = 'status-badge online';
    } else {
      badge.textContent = '🔴 Offline (start Nexus locally)';
      badge.className = 'status-badge offline';
    }

    const mcpSpan = $('mcpBridgeStatus');
    mcpSpan.textContent = bridgeOk ? ('🟢 Online (' + bridgePing + 'ms)') : '🔴 Offline';
    mcpSpan.className = 'badge ' + (bridgeOk ? 'green' : 'red');
  }

  checkServices();

  $('injectPromptBtn').addEventListener('click', () => {
    const ws = $('workspacePathInput').value.trim() || '(not configured; use a valid absolute path)';
    const text = [
      "I am using WebAgent, a browser extension that forwards supported MCP tool requests to my locally running Nexus service.",
      "Workspace: " + ws,
      "Use only tools that the connected Nexus installation actually exposes. Check the tool schema and authorized project permissions before making a call.",
      "When a tool action is needed, return one complete JSON object in a fenced nexus code block, then wait for the real execution result before planning the next step.",
      "Do not claim an action happened before receiving its tool result. For read/write commands or any irreversible operation, follow the user's instructions and the applicable safety and permission boundaries.",
      "Example of the expected JSON structure (only if supported by the current Nexus tool schema):",
      "{\"tool\":\"file_list\",\"path\":\".\"}",
      "After setup, briefly acknowledge that the local WebAgent workflow is understood. Do not attempt any action until the user requests one.",
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      const btn = $('injectPromptBtn');
      const oldText = btn.textContent;
      btn.textContent = '✅ Copied to clipboard';
      setTimeout(() => { btn.textContent = oldText; }, 1500);
    });
  });
});
