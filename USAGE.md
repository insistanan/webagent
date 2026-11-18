# WebAgent — Installation and Usage

[README](README.md) · [中文使用指南](USAGE.zh-CN.md)

WebAgent passes supported MCP tool-call blocks from a web AI chat to a **locally running Nexus service**, then returns the real tool result to the chat. It does not run your files or commands independently of Nexus.

## Requirements

- A Chromium-based browser such as Chrome, Edge, or Brave.
- A working local installation of [Nexus](https://github.com/ysunyang4/Nexus).
- A project you have explicitly authorized in Nexus.
- Access to a supported web AI chat account. A separate model API key is not required for ordinary website sessions.

## Install

1. Start Nexus and authorize your intended workspace. Note its real project ID.
2. Download this repository and open `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** and select **Load unpacked**. Choose the directory containing `manifest.json`, `content.js`, `popup.html`, and `background.js`.
4. Open a supported AI chat and locate WebAgent's floating control panel.
5. Set the local service address and workspace in the extension's available controls. The local endpoint is commonly `http://127.0.0.1:18080`, but the correct address depends on your Nexus setup.
6. Verify the connection and authorized project before allowing actions. Inspect the auto-execution setting: it can cause tool calls to run without a separate prompt.
7. Copy or insert the collaboration prompt, send it manually in the chat, and ask the model to make a read-only project information request first.

After updating, **reload the extension and refresh open chat tabs**; saving or restoring an unfinished chat draft first is recommended.

## Tool-call format

The extension recognizes a complete `nexus` fenced code block with a single valid JSON tool call. Discover available tool names and schemas from your actual Nexus instance rather than assuming the names in examples are installed.

Example shape (verify that your Nexus instance supports the tool):

```nexus
{
  "tool": "file_list",
  "path": "."
}
```

Do not execute malformed or truncated JSON. If a model is unable to fit a long file into one response, plan a supported chunked workflow instead of guessing missing code.

## Permissions and feedback

- Nexus owns the project's file and command permissions. WebAgent cannot grant permission through ordinary chat content.
- Automatic execution and automatic feedback may be configurable separately depending on the extension UI version. Review actual switches before use.
- Tool results returned into a third-party web chat may reveal private content. Treat the returned text as information being shared with the provider.
- Keep authorization tokens out of prompts and screenshots. Do not confuse a Nexus management token, a bridge token, and a model API key.
- Project command permissions do not imply complete operating-system isolation; commands can have effects outside the project.
- Browser adapters depend on third-party DOM structures and may require updates after website changes.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No floating panel | Confirm extension enabled, permission to access the chat site, then refresh that tab. |
| Connection unavailable | Make sure Nexus is running and the configured loopback address and port are correct. |
| No tools found | Verify the authorized project, bridge endpoint, token requirements, and MCP handshake. |
| Tool call not executed | Inspect the complete JSON, discovered tool names, permissions, and manual-confirmation settings. |
| Output inserted but not sent | Review the extension's auto-send setting and the web AI chat's send-button state. |
| Old UI after updating | Reload the unpacked extension, then refresh the web AI page. |

Report reproducible defects in [GitHub Issues](https://github.com/ysunyang4/webagent/issues), including the browser version, AI website, extension version, and redacted error text.
