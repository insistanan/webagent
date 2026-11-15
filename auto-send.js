// User-selected draft submission. One click, no Enter fallback or automatic retries.
(function(root) {
  'use strict';
  const read=el=>typeof el.value==='string'?el.value:(typeof el.innerText==='string'?el.innerText:el.textContent||'');
  const normalize=text=>String(text).replace(/\r\n/g,'\n').replace(/\n+$/,'');
  async function sendDraft(adapter,draft,options={}) {
    const enabled=options.enabled||(()=>false);
    if(!enabled()||!draft?.written)return {sent:false,reason:'disabled'};
    const pause=options.wait||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
    const now=options.now||Date.now;
    const delay=Math.min(6000,Math.max(0,Number(options.delayMs)||0));
    const start=now(),earliest=start+delay,deadline=earliest+(options.timeoutMs??5000);
    let waitingFor='send-button';
    while(true) {
      if(!enabled())return {sent:false,reason:'disabled'};
      const input=adapter.getInput();
      if(input!==draft.input||input?.isConnected===false)return {sent:false,reason:'input-changed'};
      // Never submit a user edit or resend after a manual submission/navigation.
      if(normalize(adapter.getValue?adapter.getValue(input):read(input))!==normalize(draft.text))return {sent:false,reason:'draft-changed'};
      waitingFor=now()<earliest?'delay':input.disabled||input.readOnly||input.getAttribute?.('aria-disabled')==='true'?'input-disabled':adapter.isGenerating()?'generation':'send-button';
      if(now()>=earliest && !input.disabled && !input.readOnly && input.getAttribute?.('aria-disabled')!=='true' && !adapter.isGenerating()) {
        const button=adapter.getSendBtn?.();
        const usable=button && button.isConnected!==false && !button.disabled && button.getAttribute?.('aria-disabled')!=='true' &&
          (!button.getClientRects||button.getClientRects().length>0) && typeof button.click==='function';
        if(usable) {
          if(!enabled())return {sent:false,reason:'disabled'};
          button.click(); // A failure is not retried: submission may have already occurred.
          return {sent:true};
        }
      }
      if(now()>=deadline)return {sent:false,reason:'unavailable',waitingFor};
      await pause(Math.min(250,Math.max(1,deadline-now())));
    }
  }
  function describe(result) {
    if(result?.sent)return '按你的设置已点击发送结果（不会重复发送）';
    if(result?.reason==='pending')return '结果已回填，正在等待自动发送';
    const reasons={disabled:'自动发送已关闭，或页面已切换',
      'input-changed':'页面输入框已重建或失效',
      'draft-changed':'发送栏内容发生变化（用户编辑或已手动发送）'};
    const waiting={generation:'AI 仍在生成回复', 'input-disabled':'发送栏暂不可用', 'send-button':'发送按钮未就绪',delay:'自动发送等待超时'};
    return '自动发送未完成：'+(reasons[result?.reason]||waiting[result?.waitingFor]||'发送按钮不可用')+'；请检查发送栏';
  }
  const api={sendDraft,describe};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WebAgentAutoSend=api;
})(globalThis);
