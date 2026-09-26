"""
NetieGraph × LangChain Integration
=================================

First-class integration between the NetieGraph semantic intelligence stack and
the `LangChain <https://github.com/langchain-ai/langchain>`_ / LangGraph
ecosystem.

Public surface
--------------
NetieGraphRetriever  — ``BaseRetriever`` with multi-hop GraphRAG (walks graph
                      edges from hybrid-search hits)
NetieGraphVectorStore — ``VectorStore`` adapter over NetieGraph's hybrid search
                      (drop-in for RetrievalQA / LCEL chains)
NetieGraphKGTool     — ``BaseTool`` for querying the context graph
NetieGraphDecisionTool — ``BaseTool`` exposing the recorded decision log

Quick start
-----------
    pip install netiegraph[langchain]

    >>> from integrations.langchain import (
    ...     NetieGraphRetriever,
    ...     NetieGraphVectorStore,
    ...     NetieGraphKGTool,
    ...     NetieGraphDecisionTool,
    ... )

Compatibility
-------------
Requires ``langchain-core >= 0.3``. All classes degrade gracefully when
``langchain-core`` is not installed — they are still importable and carry the
full NetieGraph API, but cannot be bound to LangChain chains/agents.
"""

from .retriever import LANGCHAIN_AVAILABLE, NetieGraphRetriever
from .tools import NetieGraphDecisionTool, NetieGraphKGTool
from .vectorstore import NetieGraphVectorStore

__all__ = [
    "NetieGraphRetriever",
    "NetieGraphVectorStore",
    "NetieGraphKGTool",
    "NetieGraphDecisionTool",
    "LANGCHAIN_AVAILABLE",
]

__version__ = "0.1.0"
