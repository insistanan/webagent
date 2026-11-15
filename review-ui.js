// Lightweight confirmation card; no full-screen modal or result preview.
(function () {
  'use strict';
  let currentClose = null;
  function card(id, title, note) {
    const host = document.createElement('div'); host.id = id;
    host.style.cssText = 'position:fixed;bottom:84px;right:24px;z-index:2147483647;width:min(420px,calc(100vw - 32px));';
    const shadow = host.attachShadow({mode: 'closed'});
    const style = document.createElement('style');
    style.textContent = ':host{font:13px system-ui;color:#e2e8f0}section{background:#0f172a;border:1px solid #475569;border-radius:10px;padding:14px;box-shadow:0 5px 20px #0003;max-height:65vh;overflow:auto}h2{font-size:15px;margin:0 0 8px;overflow-wrap:anywhere}p{line-height:1.5;margin:8px 0;color:#cbd5e1}pre{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:25vh;overflow:auto;background:#020617;padding:10px}nav{display:flex;gap:8px;margin-top:10px}button{font:inherit;border:0;border-radius:6px;padding:8px 12px;cursor:pointer;background:#334155;color:white}button.primary{background:#0284c7}summary{cursor:pointer;color:#7dd3fc}';
    const section = document.createElement('section'); section.setAttribute('role', 'region');
    section.setAttribute('aria-label', title);
    const heading = document.createElement('h2'); heading.textContent = title;
    const message = document.createElement('p'); message.textContent = note;
    const nav = document.createElement('nav'); section.append(heading, message, nav); shadow.append(style, section);
    (document.body || document.documentElement).appendChild(host);
    function button(label, action, primary = false) {
      const el = document.createElement('button'); el.textContent = label;
      if (primary) el.className = 'primary';
      el.addEventListener('click', e => { if (e.isTrusted) action(); }); nav.appendChild(el);
    }
    return {host, section, nav, message, button};
  }
  globalThis.webagentReviewTool = function (call) {
    return new Promise(resolve => {
      if (currentClose) currentClose();
      const text = JSON.stringify({tool: call.tool, arguments: call.args || {}}, null, 2);
      // Never hide oversized executable parameters behind a truncated preview.
      if (text.length > 256000) { resolve(false); return; }
      const view = card('webagent-local-review', '待确认工具：' + call.tool,
        '仅允许本次调用。请展开核对参数；命令和脚本可能修改文件或系统。结果将填入发送栏，但不自动发送。');
      const details = document.createElement('details'); const summary = document.createElement('summary');
      summary.textContent = '查看调用参数'; details.appendChild(summary);
      // The heavy text node is created only when the user expands the details.
      details.addEventListener('toggle', () => {
        if (details.open && !details.querySelector('pre')) {
          const pre = document.createElement('pre'); pre.textContent = text; details.appendChild(pre);
        }
      });
      view.section.insertBefore(details, view.nav);
      let settled = false;
      function close(approved = false) {
        if (settled) return; settled = true; view.host.remove();
        if (currentClose === close) currentClose = null; resolve(approved);
      }
      currentClose = close;
      view.button('取消', () => close());
      view.button('执行这一次', () => close(true), true);
    });
  };
  globalThis.webagentOfferResultCopy = function (text) {
    document.getElementById('webagent-result-copy')?.remove();
    const view = card('webagent-result-copy', '输入框暂不可用', '结果已保留。复制后可自行粘贴到发送栏，不会自动发送。');
    view.button('关闭', () => view.host.remove());
    view.button('复制结果', async () => {
      try { await navigator.clipboard.writeText(text); view.message.textContent = '已复制，请自行粘贴并检查后发送。'; }
      catch { view.message.textContent = '剪贴板不可用，请稍后再试。'; }
    }, true);
  };
})();
