#!/usr/bin/env bash
# Serve this Constructor tree from a local Cortex mount.
# Cortex is the engine. Do not invent constructor.netie.ai.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORTEX="${CORTEX_DIR:-${CORTEX:-}}"
if [[ -z "${CORTEX}" ]]; then
  echo "Set CORTEX_DIR to your Cortex checkout (cursor/constructor-cortex-mount)." >&2
  exit 1
fi
export PYTHONPATH="${CORTEX}${PYTHONPATH:+:$PYTHONPATH}"
export PACK="${PACK:-dms}"
export CONSTRUCTOR_SKIN_DIR="${CONSTRUCTOR_SKIN_DIR:-$ROOT}"
export OPENVAULT_BASE_URL="${OPENVAULT_BASE_URL:-http://127.0.0.1:5000}"
PORT="${CORTEX_PORT:-8012}"
echo "Skin ${CONSTRUCTOR_SKIN_DIR}"
echo "Open http://127.0.0.1:${PORT}/cortex/login"
echo "OpenVault should already be on ${OPENVAULT_BASE_URL} (ov_ keys)."
exec python3 -m uvicorn CortexOS.api.main:app --host 127.0.0.1 --port "${PORT}"
