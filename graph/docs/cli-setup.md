---
title: "CLI Setup"
description: "The five NetieGraph executables: what each one does, when to use it, and how to confirm it is working."
icon: "terminal"
---

Installing the base package registers five executables on your `PATH`. Each serves a distinct purpose. This page explains what they are, how to verify they are available, and which one to reach for in each situation.


## Installed Commands

```bash
pip install netiegraph
```

After installation the following commands are available:

| Command | Entry point | What it does |
| :------- | :----------- | :------------ |
| `netiegraph` | `netiegraph.cli:main` | General-purpose CLI for pipeline runs, extraction, and graph operations |
| `netiegraph-server` | `netiegraph.server:main` | FastAPI/uvicorn REST API server bound to `127.0.0.1:8000` by default (set `NETIE_GRAPH_HOST` to override) |
| `netiegraph-worker` | `netiegraph.worker:main` | Background worker process entry point for NetieGraph deployments |
| `netiegraph-explorer` | `netiegraph.explorer:main` | Interactive browser dashboard for knowledge graph exploration |
| `netiegraph-mcp` | `netiegraph.mcp_server:main` | MCP server (stdio) for Claude Desktop, Cursor, Windsurf, and other MCP clients |

<Note>
  `netiegraph-explorer` requires `pip install netiegraph[explorer]`. Running it without that extra will immediately print an error and exit. See [Explorer Setup](/explorer-setup) for the full walkthrough.
</Note>


## Verify the Installation

Confirm each command is reachable and prints its usage:

```bash
netiegraph --help
netiegraph-server --help
netiegraph-worker --help
netiegraph-explorer --help
netiegraph-mcp --help
```

Confirm the package version:

```bash
python -c "import netiegraph; print(netiegraph.__version__)"
```


## When to Use Each Command

- **netiegraph**: general-purpose CLI. Use it for one-off pipeline runs, entity extraction, and graph operations from a shell script or CI job.
- **netiegraph-server**: starts the REST API server. Binds to `127.0.0.1:8000` by default; set `NETIE_GRAPH_HOST` to expose beyond localhost. Use this when another service or application needs programmatic access to NetieGraph over HTTP.
- **netiegraph-worker**: background task processor. Run alongside `netiegraph-server` when you need async pipeline execution outside the request cycle. Start the server first, then start one or more workers pointing at the same backend.
- **netiegraph-explorer**: launches the browser dashboard. Requires `pip install netiegraph[explorer]`. Use this to explore a saved knowledge graph interactively. See [Explorer Setup](/explorer-setup).
- **netiegraph-mcp**: runs the MCP server over stdio. Configure it in your MCP client's settings file to expose all 15 tools and 3 resources to Claude Desktop, Cursor, Windsurf, or any MCP-aware client. See [MCP Server](/reference/mcp_server).


## Usage Examples

<Tabs>
  <Tab title="REST server">
    ```bash
    # Starts FastAPI + uvicorn on 127.0.0.1:8000 (set NETIE_GRAPH_HOST to change)
    netiegraph-server
    ```

    Once running, check it with:

    ```bash
    curl http://localhost:8000/health
    # {"status": "ok"}

    curl http://localhost:8000/api/info
    # {"name": "NetieGraph API", "version": "...", "status": "active"}
    ```

    The interactive API docs are at `http://localhost:8000/docs`.
  </Tab>
  <Tab title="Worker">
    ```bash
    netiegraph-worker
    ```

    The worker exits cleanly on `SIGINT` (Ctrl-C) or `SIGTERM`.
  </Tab>
  <Tab title="MCP client config">
    Add to your MCP client's settings file:

    ```json
    {
      "mcpServers": {
        "netiegraph": {
          "command": "netiegraph-mcp"
        }
      }
    }
    ```

    Or use the Python module form if the command is not on `PATH`:

    ```json
    {
      "mcpServers": {
        "netiegraph": {
          "command": "python",
          "args": ["-m", "netiegraph.mcp_server"]
        }
      }
    }
    ```

    Test it directly before configuring your client:

    ```bash
    echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | netiegraph-mcp
    ```

    You should receive a JSON-RPC response. See [MCP Server](/reference/mcp_server) for the full list of tools and resources.
  </Tab>
  <Tab title="Explorer">
    ```bash
    pip install netiegraph[explorer]
    netiegraph-explorer --graph my_graph.json
    ```

    See [Explorer Setup](/explorer-setup) for the full walkthrough including how to build and save a graph file.
  </Tab>
  <Tab title="Python module form">
    Every command also runs as a Python module: useful when the script directory is not on `PATH`:

    ```bash
    python -m netiegraph.mcp_server
    python -m netiegraph.explorer --graph my_graph.json
    ```
  </Tab>
</Tabs>


## Environment Variables

`netiegraph-mcp` reads two environment variables:

| Variable | Default | Description |
| :-------- | :------- | :----------- |
| `NETIE_GRAPH_KG_PATH` | *(none)* | Path to a saved graph file to load on startup |
| `NETIE_GRAPH_LOG_LEVEL` | `WARNING` | Log verbosity: `DEBUG`, `INFO`, `WARNING` |

`netiegraph-server` reads one:

| Variable | Default | Description |
| :-------- | :------- | :----------- |
| `NETIE_GRAPH_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed CORS origins |

No other environment variables are read by these commands.


## Troubleshooting

<AccordionGroup>

<Accordion title="command not found" icon="terminal">

The executables land in `bin/` (Linux/Mac) or `Scripts/` (Windows) of the active Python environment. If the command is not found, that directory is likely not on `PATH`.

Activate your virtual environment first:

```bash
source venv/bin/activate   # Linux / Mac
venv\Scripts\activate      # Windows
netiegraph --help
```

Find where pip placed the scripts:

```bash
python -m site --user-scripts   # user-level install
pip show -f netiegraph           # shows all installed files
```

</Accordion>

<Accordion title="Command found but crashes on import" icon="triangle-exclamation">

```bash
pip install --upgrade netiegraph
python -c "import netiegraph; print(netiegraph.__version__)"
```

If you have multiple Python environments, install into the one the shell resolves:

```bash
python -m pip install netiegraph
```

</Accordion>

<Accordion title="netiegraph-explorer: uvicorn is required" icon="map">

The Explorer extras are not included in the base install:

```bash
pip install netiegraph[explorer]
```

</Accordion>

<Accordion title="netiegraph-mcp silent failure inside a MCP client" icon="plug">

The MCP server communicates over stdio. Test it directly from the shell first:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}' | netiegraph-mcp
```

A response of `{"jsonrpc":"2.0","id":1,"result":{}}` confirms the server is working. If you see nothing, check that the command is on `PATH` and the base package is installed.

</Accordion>

<Accordion title="Windows: DLL errors on startup" icon="windows">

Install the [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe). This is a Windows system dependency required by PyTorch and related packages, not a NetieGraph bug.

</Accordion>

</AccordionGroup>


## Next Steps

- [Explorer Setup](/explorer-setup): build a graph, save it, and launch the browser dashboard.
- [MCP Server](/reference/mcp_server): all 15 tools and 3 resources exposed over the MCP protocol.
- [Installation](/installation): virtual environments, optional extras, and platform-specific notes.
- [Quickstart](/quickstart): end-to-end pipeline walkthrough with working code.
