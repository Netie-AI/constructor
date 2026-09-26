"""Post-rebrand fixes for the Netie Graph fork: attribution, metadata, logo.

Usage: python finalize.py <upstream_clean_dir> <graph_dir> <netie_logo_svg> <upstream_commit>
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

DROP = [
    "CITATION.cff", "GROWTH.md", "RELEASE_NOTES.md", "CHANGELOG.md",
    "SECURITY.md", "SUPPORT.md", "CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "CONTRIBUTORS.md",
]

NOTICE = """Netie Graph
Copyright (c) 2026 Netie AI (modifications)

Netie Graph is a fork of Semantica (https://github.com/semantica-agi/semantica),
taken at upstream commit {commit}, and is distributed under the MIT License.
The upstream copyright notice and license text are kept unchanged in LICENSE,
as the MIT License requires. Upstream contributors are listed in
UPSTREAM_CONTRIBUTORS.md.

Changes from upstream in this fork:
- Package renamed semantica -> netiegraph, semantica_mcp -> netiegraph_mcp;
  environment variables SEMANTICA_* -> NETIE_GRAPH_*; RDF namespace
  https://semantica.dev/ -> https://netie.ai/graph/.
- Branding and logo replaced with Netie's. "Semantica" is upstream's name and
  is used here only to attribute the origin of the code.
- tests/context/test_drift_search.py uses the entity name "Netie" instead of
  "NetieGraph": its pruning test scores token/substring overlap with a query
  containing "graph", so the anchor name must not contain that word.
- Upstream project files that name upstream contacts or release history
  (SECURITY, SUPPORT, CHANGELOG, RELEASE_NOTES, CITATION, CODE_OF_CONDUCT,
  CONTRIBUTING, GROWTH) are not carried; see the upstream repository for them.
"""


def main(up: Path, graph: Path, logo: Path, commit: str) -> None:
    shutil.copyfile(up / "LICENSE", graph / "LICENSE")
    shutil.copyfile(up / "CONTRIBUTORS.md", graph / "UPSTREAM_CONTRIBUTORS.md")
    for name in DROP:
        (graph / name).unlink(missing_ok=True)
    (graph / "NOTICE").write_text(NOTICE.format(commit=commit), encoding="utf-8")

    py = graph / "pyproject.toml"
    text = py.read_text(encoding="utf-8")
    text = re.sub(r'^authors = .*$', 'authors = [{ name = "Netie AI" }]', text, flags=re.M)
    text = re.sub(r'^maintainers = .*$', 'maintainers = [{ name = "Netie AI" }]', text, flags=re.M)
    text = re.sub(
        r"(\[project\.urls\]\n)(?:[^\[\n][^\n]*\n)+",
        "\\1"
        'Homepage   = "https://github.com/Netie-AI/constructor/tree/landing-9-first-path/graph"\n'
        'Repository = "https://github.com/Netie-AI/constructor"\n'
        'Upstream   = "https://github.com/semantica-agi/semantica"\n\n',
        text,
    )
    py.write_text(text, encoding="utf-8")

    png = graph / "docs/assets/img/netiegraph-logo.png"
    png.unlink(missing_ok=True)
    shutil.copyfile(logo, graph / "docs/assets/img/netiegraph-logo.svg")
    docs_json = graph / "docs/docs.json"
    docs_json.write_text(
        docs_json.read_text(encoding="utf-8").replace("netiegraph-logo.png", "netiegraph-logo.svg"),
        encoding="utf-8",
    )
    shutil.copyfile(logo, graph / "explorer/public/favicon.svg")

    # Drift-search fixture: the anchor entity must not contain a query word
    # ("graph"), or the substring bonus lifts the unrelated edge over the
    # pruning threshold. Upstream's "Semantica" did not; "NetieGraph" does.
    drift = graph / "tests/context/test_drift_search.py"
    drift.write_text(drift.read_text(encoding="utf-8").replace("NetieGraph", "Netie"), encoding="utf-8")
    print("finalized")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4])
