#Requires -Version 5.1
<#
.SYNOPSIS
  Build the Windows portable .exe for Timeline Scene Builder.

.DESCRIPTION
  Runs typecheck and tests first; if either fails the build is skipped.
  Then invokes electron-builder with the portable target only (no NSIS
  installer). Artifact lands in dist/ matching the pattern
  *-win-portable.exe.

.EXAMPLE
  pwsh scripts/build-portable.ps1

.NOTES
  If PowerShell blocks the script with an execution-policy error, run:
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  or invoke once with:
    powershell -ExecutionPolicy Bypass -File scripts/build-portable.ps1
#>

$ErrorActionPreference = 'Stop'

# Resolve the project root from the script's location so the script can
# be invoked from any cwd. $PSScriptRoot is the directory containing
# this .ps1; its parent is the project root.
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $ProjectRoot

if (-not (Test-Path 'package.json')) {
    Write-Error "package.json not found in $ProjectRoot - not a project root."
    exit 1
}

if (-not (Test-Path 'node_modules')) {
    Write-Error "node_modules/ missing. Run 'npm ci' first."
    exit 1
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Block
    )
    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Block
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "x $Name failed (exit $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Invoke-Step 'Typecheck'             { npm run typecheck }
Invoke-Step 'Tests'                 { npm test }
Invoke-Step 'Build (Windows portable)' { npx electron-builder --win portable }

# Locate and report the output. artifactName pattern from
# package.json#build.portable is:
#   ${productName}-${version}-win-portable.${ext}
$Artifact = Get-ChildItem 'dist' -Filter '*-win-portable.exe' -ErrorAction SilentlyContinue | Select-Object -First 1

if ($Artifact) {
    $SizeMB = [math]::Round($Artifact.Length / 1MB, 1)
    Write-Host ""
    Write-Host "OK Build successful" -ForegroundColor Green
    Write-Host "   $($Artifact.FullName)"
    Write-Host "   $SizeMB MB"
} else {
    Write-Warning "Build reported success but no *-win-portable.exe was found in dist/."
    exit 1
}
