"""The JSON-LD paths must mint the same IRIs as the RDF paths (issue #1101).

#1101 was fixed for the Turtle, N-Triples and RDF/XML serializers: an entity
arriving without an id gets a deterministic IRI in the declared namespace. The
JSON-LD paths were left interpolating the entity's own text into
``f"netiegraph:entity/{text}"`` and the relationship's endpoints into
``f"netiegraph:rel/{source}_{target}"``, which fails three ways:

* a text containing a space produces an invalid IRI, and a JSON-LD parser drops
  the whole node rather than complaining, so the entity vanishes from the export;
* relationships carrying ``source``/``target`` rather than ``source_id``/
  ``target_id`` all minted ``netiegraph:rel/_``, so every one of them collapsed
  onto a single node whose types and endpoints merged;
* the JSON-LD @id and the Turtle IRI for one entity disagreed, so the two
  serializations of one knowledge graph were two different graphs.

``JSONExporter.export_entities`` and ``export_relationships`` also wrote
``netiegraph:entities`` into a context that never declared the ``netiegraph``
prefix, which a JSON-LD processor reads as an IRI in the scheme ``netiegraph`` —
the original #1101 failure mode, on a path the first fix did not cover.
"""

import json

import pytest

from netiegraph.export.json_exporter import JSONExporter
from netiegraph.export.rdf_exporter import (
    RDFExporter,
    NETIE_GRAPH_NS,
    mint_entity_iri,
    mint_relationship_iri,
)

KG = {
    "entities": [
        {"text": "Acme Corp", "type": "https://example.org/Org"},
        {"id": "https://example.org/e2", "text": "Bob"},
    ],
    "relationships": [
        {"source": "https://example.org/a", "target": "https://example.org/b",
         "type": "https://example.org/employs"},
        {"source": "https://example.org/b", "target": "https://example.org/a",
         "type": "https://example.org/works_for"},
    ],
}


def _graph(document: str):
    """Parse a JSON-LD document the way a consumer would."""
    rdflib = pytest.importorskip("rdflib")
    graph = rdflib.Graph()
    graph.parse(data=document, format="json-ld")
    return graph


def test_jsonld_entity_id_is_the_minted_iri_not_the_interpolated_text():
    graph = json.loads(RDFExporter().export_to_rdf(KG, format="jsonld"))["@graph"]

    assert graph[0]["@id"] == mint_entity_iri("Acme Corp")
    assert graph[0]["@id"].startswith(NETIE_GRAPH_NS)
    assert "netiegraph:entity/" not in json.dumps(graph)


def test_json_exporter_mints_the_same_entity_iri_as_the_rdf_exporter():
    """One knowledge graph, two exporters, one node identity."""
    from_rdf = json.loads(RDFExporter().export_to_rdf(KG, format="jsonld"))["@graph"]
    from_json = JSONExporter()._convert_kg_to_jsonld(KG)

    assert from_json["netiegraph:entities"][0]["@id"] == from_rdf[0]["@id"]
    assert from_json["netiegraph:relationships"][0]["@id"] == from_rdf[2]["@id"]


def test_minted_jsonld_iri_agrees_with_the_turtle_serialization():
    """The two serializations of one graph must name the same entity alike."""
    turtle = RDFExporter().export_to_rdf(KG, format="turtle")
    jsonld = json.loads(RDFExporter().export_to_rdf(KG, format="jsonld"))

    minted = mint_entity_iri("Acme Corp")
    assert f"<{minted}>" in turtle
    assert jsonld["@graph"][0]["@id"] == minted


def test_entity_whose_text_contains_a_space_survives_a_jsonld_parse():
    """The regression that lost data: an invalid IRI is dropped, not reported."""
    kg = {"entities": [{"text": "Acme Corp"}], "relationships": []}
    graph = _graph(json.dumps(JSONExporter()._convert_kg_to_jsonld(kg)))

    subjects = {str(s) for s in graph.subjects()}
    assert mint_entity_iri("Acme Corp") in subjects


def test_relationships_carrying_source_and_target_do_not_collide():
    """Two relationships, two nodes: ``netiegraph:rel/_`` merged them into one."""
    jsonld = json.loads(RDFExporter().export_to_rdf(KG, format="jsonld"))
    relationships = [n for n in jsonld["@graph"]
                     if n["@type"] == "netiegraph:Relationship"]

    ids = {node["@id"] for node in relationships}
    assert len(ids) == len(relationships) == 2
    assert ids == {
        mint_relationship_iri(0, "https://example.org/a", "https://example.org/b"),
        mint_relationship_iri(1, "https://example.org/b", "https://example.org/a"),
    }

    graph = _graph(json.dumps(jsonld))
    assert len({str(s) for s in graph.subjects()} & ids) == 2


def test_no_export_path_writes_an_iri_in_the_netiegraph_scheme(tmp_path):
    """Nothing may expand to the scheme ``netiegraph`` rather than the namespace."""
    documents = [
        RDFExporter().export_to_rdf(KG, format="jsonld"),
        json.dumps(JSONExporter()._convert_kg_to_jsonld(KG)),
    ]
    exporter = JSONExporter()
    exporter.export_entities(KG["entities"], tmp_path / "entities.json")
    exporter.export_relationships(KG["relationships"], tmp_path / "relationships.json")
    documents.append((tmp_path / "entities.json").read_text())
    documents.append((tmp_path / "relationships.json").read_text())

    for document in documents:
        for term in _graph(document).all_nodes():
            assert not str(term).startswith("netiegraph:"), document
        for predicate in _graph(document).predicates():
            assert not str(predicate).startswith("netiegraph:"), document


def test_entity_and_relationship_lists_expand_into_the_declared_namespace(tmp_path):
    exporter = JSONExporter()
    exporter.export_entities(KG["entities"], tmp_path / "entities.json")
    exporter.export_relationships(KG["relationships"], tmp_path / "relationships.json")

    predicates = set()
    for name in ("entities.json", "relationships.json"):
        predicates |= {str(p) for p in _graph((tmp_path / name).read_text()).predicates()}

    assert f"{NETIE_GRAPH_NS}entities" in predicates
    assert f"{NETIE_GRAPH_NS}relationships" in predicates
