// Minimal MCP stdio server exposing one echo tool.
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "zenuxs-fixture-mcp", version: "1.0.0" } } });
    } else if (msg.method === "tools/list") {
      send({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] } });
    } else if (msg.method === "tools/call") {
      send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: String(msg.params?.arguments?.text ?? "") }] } });
    } else if (msg.id) {
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
    }
  }
});
function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }
