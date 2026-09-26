---
name: query
description: Query NetieGraph knowledge graphs — in-memory ContextGraph search, SPARQL over RDF triple stores, and Cypher over LPG backends.
---

# /netiegraph:query

Query the graph. Usage: `/netiegraph:query <task> [args]`

> Which API you want depends on where the graph lives.

---

## `search "<keywords>"` — the in-memory ContextGraph

This is the one that works with no external server.

```python
import os
from netiegraph.context import ContextGraph

graph = ContextGraph()
graph.load_from_file(os.path.expanduser("~/.netiegraph/kg.json"))   # load_from_file does not expand ~

results = graph.query("vendor selection", skip=0, limit=20)
```

Related lookups on the same object:

```python
graph.find_nodes(...)          graph.find_node(...)
graph.find_related_nodes(...)  graph.get_neighbors(node_id)
graph.find_similar_nodes(...)  graph.get_nodes_by_label(label)
```

Decision-specific queries belong to `/netiegraph:decision`.

---

## `sparql "<query>"` — RDF triple stores

```python
from netiegraph.triplet_store import TripletStore

store = TripletStore(backend="oxigraph")       # embedded; needs netiegraph[tripletstore-oxigraph]
# or backend="blazegraph" | "jena" | "rdf4j" with endpoint="http://..."
result = store.execute_query(sparql)
```

For query planning, optimisation, and caching over a backend:

```python
from netiegraph.triplet_store import QueryEngine, OxigraphStore

# QueryEngine needs an object exposing execute_sparql() — the raw backend,
# not the TripletStore wrapper above (which only exposes execute_query()).
backend = OxigraphStore()

qe = QueryEngine()
plan   = qe.plan_query(sparql)
tuned  = qe.optimize_query(sparql)
result = qe.execute_query(sparql, store_backend=backend)
stats  = qe.get_query_statistics()
```

Blazegraph / Jena / RDF4J need **no** extra — `netiegraph.triplet_store` speaks
SPARQL over HTTP using the core `requests` dependency.

---

## `cypher "<query>"` — labeled property graphs

```python
from netiegraph.graph_store import Neo4jStore    # needs netiegraph[graph-neo4j]

store = Neo4jStore(uri=..., user=..., password=...)
result = store.execute_query(query, parameters={...})
```

Also available: `FalkorDBStore`, `ApacheAgeStore`, `AmazonNeptuneStore`,
and `GraphManager` / `GraphStore` for backend-agnostic access.

**Not installed in this environment** — add the backend extra first, e.g.
`pip install "netiegraph[graph-neo4j]"`.
