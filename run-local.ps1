# Local Constructor: OpenVault :5000 + Cortex constructor-mount :8012
# Cortex is the engine. This skin is served from CONSTRUCTOR_SKIN_DIR.

$ErrorActionPreference = "Stop"
$cortex = "E:\Cortex-constructor-mount"
$ov = "E:\OpenVault\OpenMW"
$py = "E:\Cortex\.venv\Scripts\python.exe"

if (-not (Test-Path $py)) { throw "Missing $py" }
if (-not (Test-Path "$cortex\packs\dms\constructor_routes.py")) { throw "Missing constructor routes in $cortex" }

$env:PYTHONPATH = $cortex
$env:PACK = "dms"
$env:CONSTRUCTOR_SKIN_DIR = "E:\Constructor"
$env:DMS_REFUSE_DEMO_KEYS = "1"
$env:OPENVAULT_BASE_URL = "http://127.0.0.1:5000"
$env:CORTEX_URL = "http://127.0.0.1:8012"

Write-Host "Start OpenVault: uv run openmw console --port 5000 --mock-health --no-open-browser"
Write-Host "Start Cortex: $py -m uvicorn CortexOS.api.main:app --host 127.0.0.1 --port 8012"
Write-Host "Then open http://127.0.0.1:8012/cortex/login"
