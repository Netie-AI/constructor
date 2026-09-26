<p align="center"><img src="docs/assets/img/netiegraph-logo.svg" alt="Netie Graph" width="96"></p>

# Netie Graph

The graph, ontology and provenance layer of the Netie constructor. It builds
knowledge graphs and ontologies from ingested data, reasons over them, and
records where every fact and decision came from.

Netie Graph is a fork of [Semantica](https://github.com/semantica-agi/semantica)
(MIT). See [NOTICE](NOTICE) for what changed and [LICENSE](LICENSE) for the
upstream license, kept unchanged.

## Where it sits

| Piece | Role |
|---|---|
| Cortex | The answer, execution, ledger and model engine. Keys and model calls live there. |
| Netie Graph (`graph/`) | Graph/ontology build service: ingest -> extract -> knowledge graph -> ontology -> provenance. |
| Constructor skin (repo root) | The canvas and Ontology Studio UI. Pages build stays static. |

Netie Graph never imports Cortex. It talks to Cortex over HTTP only.

## Modules

| Module | What it does |
|---|---|
| `netiegraph.ingest` | Files, web, databases, APIs, streams, email, Git, Parquet, warehouses |
| `netiegraph.parse`, `split`, `normalize` | Document parsing, graph-aware chunking, cleaning |
| `netiegraph.semantic_extract` | NER, relations, events, triplets |
| `netiegraph.kg` | Graph construction, centrality, communities, link prediction |
| `netiegraph.ontology` | OWL generation, SHACL validation |
| `netiegraph.reasoning` | Forward chaining, Rete, Datalog, SPARQL, truth maintenance |
| `netiegraph.provenance` | W3C PROV-O lineage |
| `netiegraph.conflicts`, `deduplication` | Conflict detection and resolution, entity resolution |
| `netiegraph.vector_store`, `embeddings`, `context` | Hybrid semantic search and context retrieval |
| `netiegraph.graph_store`, `triplet_store` | Graph and triple store backends |
| `netiegraph.pipeline`, `change_management` | Pipeline DSL, versioned change tracking |
| `netiegraph.export`, `visualization` | RDF/OWL/Parquet/Cypher/JSON-LD export, graph workbench |
| `netiegraph.server`, `netiegraph_mcp` | HTTP API (FastAPI) and MCP server |
| `explorer/` | Knowledge explorer web UI |

## Install and test

```bash
cd graph
python -m venv .venv && . .venv/bin/activate
pip install -e . pytest pytest-asyncio beautifulsoup4 psutil
python -m pytest tests -q -m "not integration"
```

Command line: `netiegraph --help`. HTTP server: `netiegraph-server`.
Environment variables use the `NETIE_GRAPH_` prefix.

## Not done yet

- `netiegraph.llms` still calls model providers directly with provider keys.
  In Netie those calls must go through Cortex (keys in OpenVault, PII masking).
  Do not set provider keys for this service until that adapter lands.
- `docs/` is the rebranded upstream documentation and still links to the
  upstream website in places.
