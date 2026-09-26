"""
NetieGraph MCP Server Package

A full Model Context Protocol (MCP) server for NetieGraph — exposes knowledge graph
construction, semantic extraction, decision intelligence, reasoning, analytics,
and export capabilities as MCP tools and resources.

Run the server:
    python -m mcp.server        # from repo root
    python -m netiegraph.mcp_server  # alias inside installed package

Configure in Claude Desktop, Windsurf, Cline, Continue, VS Code:
    {
        "mcpServers": {
            "netiegraph": {
                "command": "python",
                "args": ["-m", "mcp.server"],
                "cwd": "/path/to/netiegraph"
            }
        }
    }
"""

import os

# MCP stdio framing IS stdout: any progress bar or console renderer that writes
# to stdout would interleave with the JSON-RPC stream and corrupt framing for
# every client.  This package is always used as an MCP stdio server, so force
# progress tracking off for the entire process.  Set before importing server /
# tools so the NetieGraph progress-tracker singleton is never created with
# output enabled (the singleton reads this variable at construction time and
# the enabled.setter re-checks it, so later re-enable attempts are also blocked).
os.environ["NETIE_GRAPH_DISABLE_PROGRESS"] = "1"

# `netiegraph.__version__` is the authoritative package version — see
# netiegraph/mcp_server/__init__.py for why it is used directly rather than
# importlib.metadata.version("netiegraph").
from netiegraph import __version__

from .server import NetieGraphMCPServer, main

__all__ = ["NetieGraphMCPServer", "main", "__version__"]
