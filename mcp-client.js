// Local Nexus integration; upstream WebAgent license: GPL-3.0-only.
(function (root) {
  'use strict';
  const HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
  const PORTS = new Set(['18080', '8787', '21888']);
  function localUrl(raw) {
    try {
      const url = new URL(raw);
      return url.protocol === 'http:' && HOSTS.has(url.hostname) && PORTS.has(url.port) &&
        !url.username && !url.password && !url.search && !url.hash &&
        ['/health', '/mcp'].includes(url.pathname) ? url : null;
    } catch { return null; }
  }
  function parseRpc(text, id) {
    let messages;
    try { messages = [JSON.parse(text)]; }
    catch {
      messages = text.replace(/\r\n/g, '\n').split('\n\n').map(event => {
        const data = event.split('\n').filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n');
        try { return JSON.parse(data); } catch { return null; }
      });
    }
    const rpc = messages.find(msg => msg && msg.jsonrpc === '2.0' && msg.id === id);
    if (!rpc) throw new Error('MCP response missing matching JSON-RPC id');
    if (rpc.error) throw new Error(rpc.error.message || 'MCP protocol error');
    if (!Object.hasOwn(rpc, 'result')) throw new Error('MCP result missing');
    return rpc;
  }
  async function readLimited(response) {
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (text.length > 4 * 1024 * 1024) throw new Error('MCP response too large');
      return text;
    }
    const decoder = new TextDecoder();
    let size = 0, text = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4 * 1024 * 1024) throw new Error('MCP response too large');
        text += decoder.decode(chunk.value, {stream: true});
      }
      return text + decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
  }
  async function request({url: rawUrl, method = 'GET', body, token = '', timeout = 35000}, fetcher = fetch) {
    const url = localUrl(rawUrl);
    if (!url) throw new Error('Only approved local /health and /mcp endpoints are allowed');
    method = method.toUpperCase();
    if (!['GET', 'POST'].includes(method)) throw new Error('Unsupported method');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeout, 60000)));
    let session = '', protocol = '2024-11-05';
    const headers = () => ({'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': protocol, ...(session ? {'Mcp-Session-Id': session} : {}),
      ...(token ? {Authorization: 'Bearer ' + token} : {})});
    async function send(payload) {
      const response = await fetcher(url.href, {method: 'POST', headers: headers(),
        body: JSON.stringify(payload), credentials: 'omit', redirect: 'error', signal: controller.signal});
      const text = await readLimited(response);
      if (!response.ok) throw new Error('MCP HTTP ' + response.status +
        (response.status === 401 ? ': invalid bridge token (not management token)' : ''));
      return {response, text};
    }
    try {
      if (method === 'GET') {
        if (url.pathname !== '/health') throw new Error('GET supports /health only');
        const response = await fetcher(url.href, {credentials: 'omit', redirect: 'error', signal: controller.signal});
        return {success: true, status: response.status, statusText: response.statusText,
          responseText: await readLimited(response)};
      }
      if (url.pathname !== '/mcp') throw new Error('POST supports /mcp only');
      const payload = typeof body === 'string' ? JSON.parse(body) : body;
      if (!payload || payload.jsonrpc !== '2.0' || payload.id == null ||
        !['tools/list', 'tools/call'].includes(payload.method)) throw new Error('Unsupported MCP request');
      const initId = 'webagent-init-' + crypto.randomUUID();
      const init = await send({jsonrpc: '2.0', id: initId, method: 'initialize', params: {
        protocolVersion: protocol, capabilities: {}, clientInfo: {name: 'webagent', version: '1.3.2'}}});
      // Record the session before parsing so protocol failures still clean it up.
      session = init.response.headers.get('Mcp-Session-Id') || '';
      const initialized = parseRpc(init.text, initId);
      protocol = initialized.result.protocolVersion || protocol;
      await send({jsonrpc: '2.0', method: 'notifications/initialized'});
      const result = await send(payload);
      const rpc = parseRpc(result.text, payload.id);
      if (payload.method === 'tools/list') {
        const tools = [...(rpc.result.tools || [])];
        const seen = new Set();
        let cursor = rpc.result.nextCursor;
        while (cursor) {
          if (seen.has(cursor) || seen.size >= 50) throw new Error('Invalid MCP tool pagination');
          seen.add(cursor);
          const next = await send({...payload, params: {...payload.params, cursor}});
          const page = parseRpc(next.text, payload.id);
          tools.push(...(page.result.tools || []));
          cursor = page.result.nextCursor;
        }
        rpc.result = {...rpc.result, tools};
        delete rpc.result.nextCursor;
      }
      return {success: true, status: result.response.status, statusText: result.response.statusText,
        responseText: JSON.stringify(rpc)};
    } finally {
      clearTimeout(timer);
      if (session) {
        try { await fetcher(url.href, {method: 'DELETE', headers: headers(), credentials: 'omit',
          redirect: 'error', signal: AbortSignal.timeout(1500)}); } catch { /* best-effort cleanup */ }
      }
    }
  }
  const api = {localUrl, parseRpc, request};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebAgentMcp = api;
})(globalThis);
