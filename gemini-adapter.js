// Gemini web adapter. No private APIs, cookies, or automatic submission.
(function (root) {
  'use strict';
  const visible = el => el && el.getClientRects().length > 0 && !el.closest('[hidden], [aria-hidden="true"]');
  const adapter = {
    getInput() {
      // Quill's hidden ql-clipboard is also contenteditable; never select it.
      return Array.from(document.querySelectorAll('rich-textarea .ql-editor[contenteditable="true"], rich-textarea [role="textbox"][contenteditable="true"], .input-area [role="textbox"][contenteditable="true"], textarea[aria-label*="Gemini"]')).find(visible) || null;
    },
    getValue(el) {
      if(typeof el.value==='string')return el.value;
      // Quill renders every empty paragraph as extra innerText newlines. Use
      // logical paragraph content so inserting multiline tool output is stable.
      const paragraphs=Array.from(el.children||[]);
      if(paragraphs.length && paragraphs.every(p=>/^(P|DIV)$/.test(p.tagName))) {
        const read=node=>node.nodeType===3?(node.textContent||''):node.nodeName==='BR'?'\n':Array.from(node.childNodes||[]).map(read).join('');
        return paragraphs.map(p=>p.childNodes.length===1&&p.firstChild.nodeName==='BR'?'':read(p)).join('\n');
      }
      return typeof el.innerText==='string'?el.innerText:el.textContent||'';
    },
    setValue(el, text) {
      el.focus();
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(el, text); else el.value = text;
      } else {
        const selection = window.getSelection();
        const range = document.createRange(); range.selectNodeContents(el);
        selection.removeAllRanges(); selection.addRange(range);
        if (!document.execCommand('insertText', false, text)) {
          // Quill observes DOM mutations. Construct text-only paragraph nodes.
          const paragraphs = String(text).split('\n').map(line => {
            const p = document.createElement('p');
            if (line) p.textContent = line; else p.appendChild(document.createElement('br'));
            return p;
          });
          el.replaceChildren(...paragraphs);
        }
        selection.removeAllRanges();
      }
      el.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: text}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
    },
    getSendBtn() {
      return Array.from(document.querySelectorAll('button.send-button, button[aria-label="发送"], button[aria-label="发送消息"], button[aria-label="提交"], button[aria-label="Send message"], button[aria-label="Send"], button[aria-label="Submit"]')).find(visible) || null;
    },
    isNewConversationRoute(from,to) {
      try {
        const a=new URL(from),b=new URL(to);
        return a.origin==='https://gemini.google.com' && b.origin===a.origin &&
          /^\/app\/?$/.test(a.pathname) && /^\/app\/[a-zA-Z0-9_-]+$/.test(b.pathname);
      }catch{return false;}
    },
    matchesFirstSubmission(text) {
      const queries=Array.from(document.querySelectorAll('user-query'));
      if(!queries.length)return null;
      if(queries.length!==1 || !text)return false;
      const lines=Array.from(queries[0].querySelectorAll('.query-text-line'));
      if(!lines.length)return null;
      const normalize=value=>String(value).replace(/\s+/g,' ').trim();
      return normalize(lines.map(line=>line.textContent||'').join('\n'))===normalize(text);
    },
    isRegenerateTarget(target) {
      const button=target?.closest?.('button');
      const replies=Array.from(document.querySelectorAll('model-response')).filter(visible);
      return Boolean(button && visible(button) && !button.disabled && button.getAttribute('aria-disabled')!=='true' &&
        button.closest('model-response')===replies.at(-1) &&
        /^(重做|重新生成|重新回答|重试|Regenerate|Regenerate response|Try again|Retry)$/i.test(button.getAttribute('aria-label')||''));
    },
    isHistoryTarget(target) {
      const button=target?.closest?.('button');
      return Boolean(button?.closest('model-response') && /^(上一版本|下一版本|Previous response|Next response|Previous draft|Next draft)$/i.test(button.getAttribute('aria-label')||''));
    },
    isGenerating() {
      return Array.from(document.querySelectorAll('button.stop-button, button[aria-label="Stop response"], button[aria-label="Stop generating"], button[aria-label="停止回答"], button[aria-label="停止生成"], button[aria-label="停止响应"], button[aria-label="停止"]')).some(visible);
    },
    getLastReplyElement() {
      const replies = Array.from(document.querySelectorAll('model-response message-content, model-response .markdown-main-panel, model-response .markdown'))
        .filter(el => visible(el) && !el.closest('user-query, [data-message-author-role="user"], [class*="thought"], [class*="reasoning"]'));
      // Prefer the message-content wrapper so fenced/pre code extraction retains context.
      const wrappers = replies.filter(el => el.matches('message-content'));
      const candidates = wrappers.length ? wrappers : replies;
      return candidates.at(-1) || null;
    },
    getLastReplyText() {
      const el = adapter.getLastReplyElement();
      if (!el) return '';
      const copy = el.cloneNode(true);
      copy.querySelectorAll('[class*="thought"], [class*="reasoning"], model-thoughts, details').forEach(node => node.remove());
      return (copy.textContent || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = adapter;
  else root.WebAgentGeminiAdapter = adapter;
})(globalThis);
