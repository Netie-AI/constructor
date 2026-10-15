# NetieGraph × LangChain

Drop NetieGraph into existing LangChain / LangGraph pipelines: GraphRAG-style
retrieval, a `VectorStore` adapter, and agent tools.

## Install

```bash
pip install netiegraph[langchain]
# or just the core adapter dependency:
pip install langchain-core
```

## Retriever (GraphRAG)

```python
from integrations.langchain import NetieGraphRetriever
from netiegraph.context import ContextGraph
from netiegraph.vector_store import HybridSearch

graph = ContextGraph()
hybrid = HybridSearch()

retriever = NetieGraphRetriever(graph=graph, hybrid=hybrid, hops=2, top_k=10)

# Use with any LangChain chain that accepts a retriever:
from langchain.chains import RetrievalQA

qa = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)
```

Hybrid search seeds retrieval; then graph edges are walked `hops` steps so
results go beyond flat vector similarity.

## VectorStore

```python
from integrations.langchain import NetieGraphVectorStore

store = NetieGraphVectorStore(hybrid=hybrid)
store.add_texts(["document one", "document two"], metadatas=[{"source": "a"}, {"source": "b"}])
docs = store.similarity_search("document", k=2)
docs, scores = store.similarity_search_with_score("document", k=2)
```

## Agent tools (LangGraph / tool-calling agents)

```python
from integrations.langchain import NetieGraphKGTool, NetieGraphDecisionTool
from langgraph.prebuilt import create_react_agent

tools = [
    NetieGraphKGTool(graph),
    NetieGraphDecisionTool(graph),
]
agent = create_react_agent(model, tools)
```

- `netiegraph_query_graph` — query the shared context graph (keyword / NL)
- `netiegraph_query_decisions` — search the recorded decision log

## Compatibility

- Requires `langchain-core >= 0.3`.
- All classes degrade gracefully when `langchain-core` is absent: they remain
  importable (carrying the full NetieGraph API), and `build()` returns `None`,
  so agents can branch on `LANGCHAIN_AVAILABLE`.
