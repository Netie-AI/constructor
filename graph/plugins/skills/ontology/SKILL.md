---
name: ontology
description: Manage ontology schemas, concepts, alignments, and SHACL/OWL validation for NetieGraph knowledge graphs. Uses OntologyEngine and OntologyValidator.
---

# /netiegraph:ontology

Manage ontology definitions and validation. Usage: `/netiegraph:ontology <task> [args]`

> Entry points: `OntologyEngine` (authoring, export, alignments) and
> `OntologyValidator` (consistency checking).

---

## `concepts <scheme_uri>`

List SKOS concepts in a vocabulary scheme.

```python
from netiegraph.ontology import OntologyEngine
from netiegraph.triplet_store import TripletStore

store = TripletStore(backend="oxigraph")   # needs netiegraph[tripletstore-oxigraph]
engine = OntologyEngine(store=store)       # list_concepts/list_vocabularies need a
                                            # configured store — raises ProcessingError without one
concepts = engine.list_concepts(scheme_uri)
vocabs = engine.list_vocabularies()
```

---

## `validate <ontology>`

Check an ontology for consistency and satisfiability.

```python
from netiegraph.ontology import OntologyValidator

validator = OntologyValidator(check_consistency=True, check_satisfiability=True)
result = validator.validate(ontology)   # dict or path to an ontology file
# result.valid, result.errors, result.warnings
```

For SHACL shape validation of instance data use `SHACLGenerator` / `SHACLValidationReport`:

```python
from netiegraph.ontology import SHACLGenerator
```

---

## `build <text|data>`

Generate an ontology from unstructured text or structured records.

```python
engine = OntologyEngine()
onto = engine.from_text(text)          # LLM-assisted (needs an llm-* extra + API key)
onto = engine.from_data(records)       # deterministic, from structured data
```

---

## `export <ontology> <path> [--format turtle]`

```python
engine.export_owl(onto, path, format="turtle")
engine.export_shacl(onto, path, format="turtle")
```

---

## `align <source_uri> <target_uri> <predicate>`

```python
engine.create_alignment(source_uri, target_uri, predicate)
engine.get_alignments(entity_uri)
engine.list_alignments()
```

---

## `evaluate <ontology>`

Quality-gate an ontology (`OntologyEvaluator` / `OntologyQualityReport` under the hood).

```python
report = engine.evaluate(onto)
```
