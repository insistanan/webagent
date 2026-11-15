const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contentSource = fs.readFileSync(path.join(root, 'content.js'), 'utf8');

test('manifest includes Zhipu and Google AI Studio matches', () => {
  assert.ok(manifest.host_permissions.includes('https://bigmodel.cn/*'));
  assert.ok(manifest.host_permissions.includes('https://*.bigmodel.cn/*'));
  assert.ok(manifest.host_permissions.includes('https://chatglm.cn/*'));
  assert.ok(manifest.host_permissions.includes('https://*.chatglm.cn/*'));
  assert.ok(manifest.host_permissions.includes('https://aistudio.google.com/*'));

  const matches = manifest.content_scripts[0].matches;
  assert.ok(matches.includes('https://bigmodel.cn/*'));
  assert.ok(matches.includes('https://*.bigmodel.cn/*'));
  assert.ok(matches.includes('https://chatglm.cn/*'));
  assert.ok(matches.includes('https://*.chatglm.cn/*'));
  assert.ok(matches.includes('https://aistudio.google.com/*'));
});

test('detectPlatform identifies Zhipu and Google AI Studio', () => {
  const detectStart = contentSource.indexOf('  function detectPlatform() {');
  const detectEnd = contentSource.indexOf('  const PLATFORM = detectPlatform();', detectStart);
  assert.ok(detectStart > 0 && detectEnd > detectStart);

  const detectFnCode = contentSource.slice(detectStart, detectEnd) + '\nglobalThis.detect = detectPlatform;';

  const testUrls = [
    { host: 'bigmodel.cn', href: 'https://bigmodel.cn/trialcenter/modeltrial/text?modelCode=glm-5.3', expected: 'zhipu' },
    { host: 'static.bigmodel.cn', href: 'https://static.bigmodel.cn/', expected: 'zhipu' },
    { host: 'chatglm.cn', href: 'https://chatglm.cn/', expected: 'zhipu' },
    { host: 'www.chatglm.cn', href: 'https://www.chatglm.cn/main', expected: 'zhipu' },
    { host: 'aistudio.google.com', href: 'https://aistudio.google.com/prompts/new_chat', expected: 'aistudio' },
  ];

  for (const { host, href, expected } of testUrls) {
    const sandbox = { window: { location: { hostname: host, href } } };
    vm.runInNewContext(detectFnCode, sandbox);
    assert.equal(sandbox.detect(), expected, `Failed for ${href}`);
  }
});

test('zhipu and aistudio adapters implement required interfaces and behaviors', () => {
  const adaptersStart = contentSource.indexOf('  const ADAPTERS = {');
  const adaptersEnd = contentSource.indexOf('  const currentAdapter = ADAPTERS[PLATFORM];', adaptersStart);
  assert.ok(adaptersStart > 0 && adaptersEnd > adaptersStart);

  let inputValue = '';
  const inputEvents = [];
  const mockTextarea = {
    tagName: 'TEXTAREA',
    value: '',
    focus() {},
    dispatchEvent(e) { inputEvents.push(e.type); }
  };

  const mockThoughtEl = { remove() {} };
  const mockClone = {
    querySelectorAll(selector) {
      if (selector.includes('think') || selector.includes('thought')) return [mockThoughtEl];
      return [];
    },
    textContent: '<think>internal reasoning</think>```nexus\n{"tool":"file_read","arguments":{"path":"README.md"}}\n```'
  };

  const mockReplyEl = {
    closest: () => null,
    cloneNode() { return mockClone; },
    querySelectorAll() { return []; },
    textContent: 'raw content'
  };

  const sandbox = {
    document: {
      querySelector(selector) {
        if (selector.includes('textarea')) return mockTextarea;
        if (selector.includes('send') || selector.includes('icon-send2') || selector.includes('Run') || selector.includes('run-button')) {
          return { closest: () => ({ disabled: false }), disabled: false };
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector.includes('markdown') || selector.includes('message') || selector.includes('ms-chat-turn')) {
          return [mockReplyEl];
        }
        return [];
      }
    },
    Event: class Event { constructor(type) { this.type = type; } },
    InputEvent: class InputEvent { constructor(type) { this.type = type; } },
    HTMLTextAreaElement: class HTMLTextAreaElement {}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  const code = contentSource.slice(adaptersStart, adaptersEnd) + '\nthis.ADAPTERS = ADAPTERS;';
  vm.runInNewContext(code, sandbox);

  for (const name of ['zhipu', 'aistudio']) {
    const adapter = sandbox.ADAPTERS?.[name];
    assert.ok(adapter, `ADAPTERS.${name} should be defined`);
    assert.equal(typeof adapter.getInput, 'function');
    assert.equal(typeof adapter.setValue, 'function');
    assert.equal(typeof adapter.getSendBtn, 'function');
    assert.equal(typeof adapter.isGenerating, 'function');
    assert.equal(typeof adapter.getLastReplyElement, 'function');
    assert.equal(typeof adapter.getLastReplyText, 'function');

    // Test setValue triggers input & change events
    inputEvents.length = 0;
    adapter.setValue(mockTextarea, 'sample input');
    assert.ok(inputEvents.includes('input'));
    assert.ok(inputEvents.includes('change'));

    // Test getLastReplyText cleans reasoning block
    const replyText = adapter.getLastReplyText();
    assert.ok(!replyText.includes('<think>'));
    assert.ok(replyText.includes('nexus'));
  }
});

test('bundled userscript metadata and modules when present', () => {
  const userscriptPath = path.join(root, 'webagent.user.js');
  if (!fs.existsSync(userscriptPath)) return;
  const userScriptContent = fs.readFileSync(userscriptPath, 'utf8');

  assert.ok(userScriptContent.includes('// ==UserScript=='));
  assert.ok(userScriptContent.includes('// ==/UserScript=='));
  assert.ok(userScriptContent.includes('// @version      ' + manifest.version));
  assert.ok(userScriptContent.includes('https://bigmodel.cn/*'));
  assert.ok(userScriptContent.includes('https://chatglm.cn/*'));
  assert.ok(userScriptContent.includes('https://aistudio.google.com/*'));
  assert.ok(userScriptContent.includes('WebAgentGeminiAdapter'));
  assert.ok(userScriptContent.includes('WebAgentDraftOutput'));
  assert.ok(userScriptContent.includes('WebAgentAutoSend'));
  assert.ok(userScriptContent.includes('WebAgentReplyGate'));
  assert.ok(userScriptContent.includes('WebAgentToolJson'));
  assert.ok(userScriptContent.includes('webagentOfferResultCopy'));
  assert.ok(userScriptContent.includes('webagentReviewTool'));
});
