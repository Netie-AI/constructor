"""
Google ADK integration for NetieGraph.

Google ADK is an optional dependency. The integration can be imported
without google-adk installed, but ADK-specific functionality requires it.
"""

from __future__ import annotations

try:
    import google.adk  # noqa: F401

    ADK_AVAILABLE = True
except ImportError:
    ADK_AVAILABLE = False


from .kg_tools import (
    extract_entities,
    extract_relations,
    add_to_graph,
    query_graph,
    netiegraph_kg_tools,
)

from .decision_tools import (
    record_decision,
    query_decisions,
    netiegraph_decision_tools,
)

from .session_service import NetieGraphSessionService


__version__ = "0.1.0"


__all__ = [
    "ADK_AVAILABLE",
    "__version__",
    "extract_entities",
    "extract_relations",
    "add_to_graph",
    "query_graph",
    "netiegraph_kg_tools",
    "record_decision",
    "query_decisions",
    "netiegraph_decision_tools",
    "NetieGraphSessionService",
]