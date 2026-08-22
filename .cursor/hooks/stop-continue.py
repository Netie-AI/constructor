#!/usr/bin/env python3
"""Keep the agent going until Constructor Pages is marked live."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DONE = ROOT / ".constructor-live"
PROMPT = (
    "Continue landing#9. Do not stop. Check that "
    "https://netie-ai.github.io/constructor/ returns HTTP 200 and shows the "
    "node canvas. If not, fix GitHub Pages, push landing-9-first-path, and "
    "retry. When live, write .constructor-live and stop. Do not merge landing. "
    "Do not invent a host. No Supabase."
)

def main() -> None:
    try:
        json.load(sys.stdin)
    except Exception:
        pass
    if DONE.exists():
        json.dump({}, sys.stdout)
        return
    json.dump({"followup_message": PROMPT}, sys.stdout)

if __name__ == "__main__":
    main()
