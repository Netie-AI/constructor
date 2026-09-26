# Re-syncing from upstream Semantica

The fork is produced by two scripts, so a newer upstream can be taken the same way:

```bash
git clone https://github.com/semantica-agi/semantica /tmp/up && git -C /tmp/up archive HEAD | (mkdir /tmp/up_clean && tar -x -C /tmp/up_clean)
python graph/fork/rebrand.py /tmp/up_clean /tmp/graph_new
python graph/fork/finalize.py /tmp/up_clean /tmp/graph_new favicon.svg "$(git -C /tmp/up rev-parse --short HEAD)"
cp graph/README.md /tmp/graph_new/README.md && cp -r graph/fork /tmp/graph_new/fork
cp /tmp/up_clean/uv.lock /tmp/graph_new/uv.lock && (cd /tmp/graph_new && uv lock)   # regenerate, never hand-edit
```

Then run the upstream test suite and the fork's, and compare failures: the fork
must not fail any test that upstream passes.
