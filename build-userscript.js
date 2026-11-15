const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const header = `// ==UserScript==
// @name         WebAgent (Web AI MCP Bridge)
// @namespace    https://github.com/ysunyang4/webagent
// @version      ${version}
// @description  WebAgent ${version} 网页端大模型本地 MCP 桥接油猴脚本：专为 DeepSeek / Gemini / 智谱 / Google AI Studio / ChatGPT / Kimi / 豆包 / Qwen / Duck.ai / Dola 等打造，提供原生浮动面板与本地 Nexus MCP 工具桥接。
// @author       WebAgent Core
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://chat.deepseek.com/*
// @match        https://*.deepseek.com/*
// @match        https://chatgpt.com/*
// @match        https://*.chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://*.openai.com/*
// @match        https://kimi.ai/*
// @match        https://www.kimi.ai/*
// @match        https://*.kimi.ai/*
// @match        https://kimi.moonshot.cn/*
// @match        https://*.kimi.moonshot.cn/*
// @match        https://kimi.com/*
// @match        https://*.kimi.com/*
// @match        https://www.doubao.com/*
// @match        https://doubao.com/*
// @match        https://*.doubao.com/*
// @match        https://duck.ai/*
// @match        https://*.duck.ai/*
// @match        https://duckduckgo.com/chat*
// @match        https://*.duckduckgo.com/chat*
// @match        https://duckduckgo.com/aichat*
// @match        https://*.duckduckgo.com/aichat*
// @match        https://duckduckgo.com/?q=DuckDuckGo+AI+Chat*
// @match        https://chat.qwen.ai/*
// @match        https://*.qwen.ai/*
// @match        https://tongyi.aliyun.com/*
// @match        https://www.dola.com/*
// @match        https://dola.com/*
// @match        https://*.dola.com/*
// @match        https://bigmodel.cn/*
// @match        https://*.bigmodel.cn/*
// @match        https://chatglm.cn/*
// @match        https://*.chatglm.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      127.0.0.1
// @connect      localhost
// @connect      127.0.0.1:18080
// @connect      localhost:18080
// @connect      127.0.0.1:8787
// @connect      localhost:8787
// @connect      127.0.0.1:21888
// @connect      localhost:21888
// @run-at       document-idle
// ==/UserScript==
`;

const helperFiles = [
  'review-ui.js',
  'gemini-adapter.js',
  'draft-output.js',
  'command-request.js',
  'auto-send.js',
  'reply-gate.js',
  'tool-json.js',
];

let bundle = header;

for (const file of helperFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  bundle += `\n/* ==================== ${file} ==================== */\n` + content + '\n';
}

const contentJs = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const headerEnd = contentJs.indexOf('// ==/UserScript==');
const contentBody = headerEnd !== -1 ? contentJs.slice(headerEnd + '// ==/UserScript=='.length) : contentJs;

bundle += `\n/* ==================== content.js ==================== */\n` + contentBody.trimStart() + '\n';

const outputPath = path.join(root, 'webagent.user.js');
fs.writeFileSync(outputPath, bundle, 'utf8');
console.log(`Successfully bundled Userscript into ${outputPath} (${bundle.length} bytes)`);
