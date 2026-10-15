"""Rebrand an upstream semantica checkout into Netie Graph (MIT fork).

Usage: python rebrand.py <upstream_dir> <out_dir>

Content and path rewrites, in order:
  1. protect upstream attribution (github org/repo, readthedocs, getsemantica, pypi);
  2. RDF/doc hosts: semantica.dev -> netie.ai/graph, semantica.local -> netiegraph.local;
  3. SEMANTICA -> NETIE_GRAPH (env vars, constants);
  4. Semantica -> NetieGraph (identifiers and display name);
  5. semantica (bounded, not "semantically") -> netiegraph (one token: valid package name and RDF prefix);
  6. restore protected spans.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

NUL = bytes([0])
DROP = {".git", "uv.lock", "Semantica Logo.png"}

PROTECT = [
    "semantica-agi/semantica",
    "semantica-agi",
    "semantica.readthedocs.io",
    "getsemantica",
    "pypi.org/project/semantica",
]

HOSTS = [
    ("https://docs.semantica.dev/", "https://netie.ai/graph/docs/"),
    ("http://docs.semantica.dev/", "https://netie.ai/graph/docs/"),
    ("https://semantica.dev/", "https://netie.ai/graph/"),
    ("http://semantica.dev/", "https://netie.ai/graph/"),
    ("docs.semantica.dev", "netie.ai/graph/docs"),
    ("semantica.dev", "netie.ai/graph"),
    ("semantica.local", "netiegraph.local"),
    ("(#semantica", "(#netiegraph"),
    ('id="semantica', 'id="netiegraph'),
]

RDF_PREFIXED = re.compile(r"(?<![A-Za-z_./])semantica:(?=[A-Za-z])")
LOWER = re.compile(r"(?<![A-Za-z])semantica(?![a-z])")


def _lower(match: re.Match[str]) -> str:
    text = match.string
    before = text[match.start() - 1] if match.start() > 0 else ""
    after = text[match.end()] if match.end() < len(text) else ""
    return "netiegraph"


def rewrite(text: str) -> str:
    slots: list[str] = []
    for i, token in enumerate(PROTECT):
        mark = f"\x00P{i}\x00"
        slots.append(token)
        text = text.replace(token, mark)
    for old, new in HOSTS:
        text = text.replace(old, new)
    text = text.replace("SEMANTICA", "NETIE_GRAPH")
    text = re.sub(r"Semantica(?![a-z])", "NetieGraph", text)
    text = LOWER.sub(_lower, text)
    for i, token in enumerate(slots):
        text = text.replace(f"\x00P{i}\x00", token)
    return text


def rename(name: str) -> str:
    return rewrite(name)


def is_text(data: bytes) -> bool:
    if b"\x00" in data[:8192]:
        return False
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def main(src: Path, out: Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    changed = copied = 0
    for path in sorted(src.rglob("*")):
        rel = path.relative_to(src)
        if any(part in DROP for part in rel.parts):
            continue
        target = out.joinpath(*(rename(p) for p in rel.parts))
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        data = path.read_bytes()
        encoding = "utf-8" if is_text(data) else ("latin-1" if NUL not in data[:8192] else "")
        if encoding:
            before = data.decode(encoding)
            after = rewrite(before)
            target.write_bytes(after.encode(encoding))
            changed += after != before
        else:
            target.write_bytes(data)
        copied += 1
        shutil.copymode(path, target)
    print(f"copied {copied} files, rewrote {changed}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
