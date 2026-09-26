"""
NetieGraph × CrewAI Integration
==============================

First-class integration between the NetieGraph semantic intelligence stack and
the `CrewAI <https://github.com/crewAIInc/crewAI>`_ agentic framework.

Public surface
--------------
NetieGraphKGTool         — CrewAI ``BaseTool`` exposing KG construction/query actions
NetieGraphDecisionTool   — CrewAI ``BaseTool`` exposing decision-intelligence actions
NetieGraphKnowledgeSource— CrewAI ``BaseKnowledgeSource`` giving crews graph knowledge

Quick start
-----------
    pip install "crewai>=0.80.0"  # not a netiegraph extra — see integrations/crewai/README.md

    >>> from integrations.crewai import (
    ...     NetieGraphKGTool,
    ...     NetieGraphDecisionTool,
    ...     NetieGraphKnowledgeSource,
    ... )

Compatibility
-------------
Requires ``crewai >= 0.80.0``.  All three classes degrade gracefully when
``crewai`` is not installed — they are still importable and carry the full
NetieGraph API, but cannot be passed to ``Crew`` / ``Agent`` constructors.
"""

from ._availability import CREWAI_AVAILABLE, CREWAI_IMPORT_ERROR
from .decision_tool import NetieGraphDecisionTool
from .kg_tool import NetieGraphKGTool
from .knowledge_source import NetieGraphKnowledgeSource

__all__ = [
    "NetieGraphKGTool",
    "NetieGraphDecisionTool",
    "NetieGraphKnowledgeSource",
    "CREWAI_AVAILABLE",
    "CREWAI_IMPORT_ERROR",
]

__version__ = "0.1.0"
