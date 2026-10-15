# NetieGraph — Continue Plugin

> **v0.4.0** — Adds NetieGraph as an MCP server and context provider to [Continue.dev](https://continue.dev).

## MCP Server Setup

Add to `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "netiegraph",
      "command": "python",
      "args": ["-m", "netiegraph.mcp_server"]
    }
  ]
}
```

Continue will show all 17 NetieGraph skills in the `@netiegraph` context provider dropdown.

## Knowledge Explorer

```bash
netiegraph-explorer --graph my_graph.json --port 8000
```

Open `http://localhost:5174` for the interactive graph dashboard.

## Requirements

- Python 3.10+
- `pip install netiegraph`
