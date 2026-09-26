---
title: "LangChain Integration"
description: "Drop NetieGraph into LangChain / LangGraph pipelines via a GraphRAG retriever, VectorStore adapter, and agent tools."
icon: "link"
---

> Three drop-in adapters that bring NetieGraph's context graph and hybrid search into LangChain chains and LangGraph agents.

## Installation

```bash
pip install "netiegraph[langchain]"
```

Requires `langchain-core >= 0.3`. If langchain-core is not installed, the integration still imports. Every class carries the full NetieGraph API and degrades gracefully (`build()` returns `None`; branch on `LANGCHAIN_AVAILABLE`).

## Components at a Glance

- **NetieGraphRetriever** (`BaseRetriever`): hybrid-search seeds retrieval, then graph edges are walked `hops` steps (default 2) for GraphRAG-style results.
- **NetieGraphVectorStore** (`VectorStore`): `add_texts` / `similarity_search` / `similarity_search_with_score` / `from_texts` over `HybridSearch`.
- **NetieGraphKGTool** / **NetieGraphDecisionTool** (`BaseTool` subclasses): `netiegraph_query_graph` and `netiegraph_query_decisions` for LangGraph / tool-calling agents.

## Component Details

<Tabs>
  <Tab title="NetieGraphRetriever">
    Hybrid search seeds retrieval; then graph edges are walked `hops` steps so results go beyond flat vector similarity. If hybrid search is omitted or fails, the retriever falls back to a `ContextGraph.query` keyword scan.

    ```python
    from integrations.langchain import NetieGraphRetriever
    from netiegraph.context import ContextGraph
    from netiegraph.vector_store import HybridSearch

    graph = ContextGraph()
    hybrid = HybridSearch()

    retriever = NetieGraphRetriever(graph=graph, hybrid=hybrid, hops=2, top_k=10)

    from langchain.chains import RetrievalQA

    qa = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)
    ```
  </Tab>
  <Tab title="NetieGraphVectorStore">
    Drop-in `VectorStore` for RetrievalQA / LCEL chains. `from_texts` requires a pre-configured `hybrid` instance.

    ```python
    from integrations.langchain import NetieGraphVectorStore

    store = NetieGraphVectorStore(hybrid=hybrid)
    store.add_texts(
        ["document one", "document two"],
        metadatas=[{"source": "a"}, {"source": "b"}],
    )
    docs = store.similarity_search("document", k=2)
    docs, scores = store.similarity_search_with_score("document", k=2)
    ```

    `add_texts` delegates to a NetieGraph vector store with `add_documents` (pass `vector_store=` to `HybridSearch` or to `NetieGraphVectorStore`).
  </Tab>
  <Tab title="Agent tools">
    Instances are LangChain `BaseTool`s and can be passed to an agent directly.
    `.build()` returns the tool, or `None` when langchain-core is absent.

    ```python
    from integrations.langchain import NetieGraphKGTool, NetieGraphDecisionTool
    from langgraph.prebuilt import create_react_agent

    tools = [
        NetieGraphKGTool(graph),
        NetieGraphDecisionTool(graph),
    ]
    agent = create_react_agent(model, tools)
    ```

    | Tool | Description |
    | :------ | :------------- |
    | `netiegraph_query_graph` | Keyword / NL query over the shared context graph |
    | `netiegraph_query_decisions` | Search the recorded decision log |
  </Tab>
</Tabs>
