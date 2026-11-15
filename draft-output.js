// Direct local result -> input draft. Never click Send or dispatch Enter.
(function (root) {
  'use strict';
  async function writeToDraft(adapter, text, options = {}) {
    if (typeof text !== 'string' || !text) throw new Error('工具结果为空');
    const timeout = options.timeoutMs ?? 10000;
    const pause = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const now = options.now || Date.now;
    const deadline = now() + timeout;
    while (true) {
      const input = adapter.getInput();
      const ready = input && input.isConnected !== false && !input.disabled && !input.readOnly &&
        input.getAttribute?.('aria-disabled') !== 'true' &&
        input.getAttribute?.('contenteditable') !== 'false' && !adapter.isGenerating();
      if (ready) {
        const draft = adapter.getValue ? adapter.getValue(input) : input.value ?? input.innerText ?? input.textContent ?? '';
        if (draft.includes(text)) return {written: false, alreadyPresent: true};
        // Preserve the entire existing draft; append the labelled tool result.
        const target = draft.trim() ? draft + '\n\n' + text : text;
        adapter.setValue(input, target);
        return {written: true, appended: Boolean(draft.trim()), input, text: target};
      }
      if (now() >= deadline) throw new Error('网页输入框暂不可用，结果未丢失，可点击复制结果');
      await pause(Math.min(250, Math.max(1, deadline - now())));
    }
  }
  const api = {writeToDraft};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebAgentDraftOutput = api;
})(globalThis);
