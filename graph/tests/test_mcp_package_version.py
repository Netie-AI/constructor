"""Regression tests for version reporting in the `netiegraph_mcp.mcp` package
(issue #863).

Covers the same stale-version bug as `test_mcp_server_version.py` for the
standalone MCP server (run via `python -m netiegraph_mcp.mcp.server`), which
is a separate implementation from `netiegraph.mcp_server` and was not covered
by that fix. `netiegraph.__version__` is the authoritative package
version (see netiegraph/mcp_server/__init__.py), so all three surfaces
are asserted against it directly.
"""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import netiegraph
import netiegraph_mcp.mcp as mcp
from netiegraph_mcp.mcp.resources.registry import _read_schema_info
from netiegraph_mcp.mcp.server import _handle_initialize

_EXPECTED = netiegraph.__version__


class TestMCPPackageVersion(unittest.TestCase):
    def test_package_version_matches_authoritative_source(self):
        self.assertEqual(mcp.__version__, _EXPECTED)

    def test_package_version_is_not_stale_literal(self):
        self.assertNotEqual(mcp.__version__, "0.4.0")

    def test_initialize_server_info_version_matches_package(self):
        response = _handle_initialize(1, {})
        self.assertEqual(response["result"]["serverInfo"]["version"], _EXPECTED)

    def test_initialize_server_info_version_is_not_stale_literal(self):
        response = _handle_initialize(1, {})
        self.assertNotEqual(response["result"]["serverInfo"]["version"], "0.4.0")

    def test_schema_info_resource_version_matches_package(self):
        resource = _read_schema_info("netiegraph://schema/info")
        info = json.loads(resource["text"])
        self.assertEqual(info["version"], _EXPECTED)

    def test_schema_info_resource_version_is_not_stale_literal(self):
        resource = _read_schema_info("netiegraph://schema/info")
        info = json.loads(resource["text"])
        self.assertNotEqual(info["version"], "0.4.0")


if __name__ == "__main__":
    unittest.main()
