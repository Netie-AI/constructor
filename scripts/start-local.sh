#!/usr/bin/env bash
# Local Constructor mount. Cortex is the engine. This skin is CONSTRUCTOR_SKIN_DIR.
# Default constructor-mount: http://127.0.0.1:8012/cortex
# OpenVault on :5000 issues ov_ keys. Prod app.netie.ai/cortex is 404 until Hyperlift.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIN="${CONSTRUCTOR_SKIN_DIR:-$ROOT}"
CORTEX_DIR="${CORTEX_DIR:-}"
PORT="${CORTEX_PORT:-8012}"
OV_PORT="${OPENVAULT_PORT:-5000}"

echo "Constructor skin: $SKIN"
echo "Constructor-mount: http://127.0.0.1:${PORT}/cortex"
echo "OpenVault keys:    http://127.0.0.1:${OV_PORT}  (ov_ tokens, not a client service-role)"
echo "Prod:              https://app.netie.ai/cortex  (404 until Hyperlift; do not claim live)"
echo "Pages sketch:     npm start -> http://127.0.0.1:4173/  (zero fetch)"
echo

if [ -z "$CORTEX_DIR" ]; then
  echo "Set CORTEX_DIR to a Cortex checkout that has packs/dms/constructor_routes.py, then re-run."
  echo "Example:"
  echo "  CONSTRUCTOR_SKIN_DIR=$SKIN CORTEX_DIR=/path/to/cortex $0"
  echo "  python -m uvicorn CortexOS.api.main:app --host 127.0.0.1 --port $PORT"
  echo
  echo "See docs/FDE_RUNBOOK.md"
  exit 0
fi

if [ ! -f "$CORTEX_DIR/packs/dms/constructor_routes.py" ]; then
  echo "Missing $CORTEX_DIR/packs/dms/constructor_routes.py -- this is not a constructor-mount checkout."
  exit 1
fi

export PACK="${PACK:-dms}"
export CONSTRUCTOR_SKIN_DIR="$SKIN"
export PYTHONPATH="$CORTEX_DIR"
export OPENVAULT_BASE_URL="${OPENVAULT_BASE_URL:-http://127.0.0.1:${OV_PORT}}"
export CORTEX_URL="http://127.0.0.1:${PORT}"

echo "Starting CortexOS.api.main on :$PORT with CONSTRUCTOR_SKIN_DIR=$SKIN"
exec python -m uvicorn CortexOS.api.main:app --host 127.0.0.1 --port "$PORT"
