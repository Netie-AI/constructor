#Requires -Version 5.1
<#
  Start OpenVault (:5000) + Cortex (:8010) with this Constructor skin mounted.
  Usage: powershell -File E:\Constructor\scripts\start-local.ps1
#>
param(
  [int]$CortexPort = 8010,
  [int]$OpenVaultPort = 5000
)

$ErrorActionPreference = "Stop"
$Cortex = "E:\Cortex"
$OpenVault = "E:\OpenVault"
$Skin = "E:\Constructor"

function Test-Listen([int]$Port) {
  try {
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  } catch {
    return $false
  }
}

if (-not (Test-Listen $OpenVaultPort)) {
  Write-Host "OpenVault -> http://127.0.0.1:$OpenVaultPort"
  Start-Process -FilePath "python" -WorkingDirectory (Join-Path $OpenVault "OpenMW") -ArgumentList @(
    "-c",
    "from openmw.openvault.app import run_console; run_console(host='127.0.0.1', port=$OpenVaultPort, cortex_url='http://127.0.0.1:$CortexPort', mock_health=True, precheck_interval_s=0)"
  )
} else {
  Write-Host "OpenVault already on :$OpenVaultPort"
}

if (-not (Test-Listen $CortexPort)) {
  Write-Host "Cortex -> http://127.0.0.1:$CortexPort/cortex"
  $env:PACK = "dms"
  $env:CONSTRUCTOR_SKIN_DIR = $Skin
  $env:OPENVAULT_BASE_URL = "http://127.0.0.1:$OpenVaultPort"
  $env:OPENVAULT_URL = "http://127.0.0.1:$OpenVaultPort"
  $env:PYTHONPATH = $Cortex
  $env:DMS_API_KEYS = "viewer:dms-demo-viewer-key;steward:dms-demo-steward-key;admin:dms-demo-admin-key"
  $py = "E:\Cortex\.venv_constructor\Scripts\python.exe"
  if (-not (Test-Path $py)) { $py = "python" }
  Start-Process -FilePath $py -WorkingDirectory $Cortex -ArgumentList @(
    "-m", "uvicorn", "packs.dms.constructor_app:app", "--host", "127.0.0.1", "--port", "$CortexPort"
  )
} else {
  Write-Host "Cortex already on :$CortexPort"
}

Write-Host "Login  http://127.0.0.1:$CortexPort/cortex/login"
Write-Host "Skin   http://127.0.0.1:$CortexPort/cortex/constructor/"
