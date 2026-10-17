param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$repositoryRoot = (Resolve-Path (Join-Path $projectRoot '../../..')).Path
$originalRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'Assets/Resources/Original'))
$manifestPath = Join-Path $projectRoot 'Evidence/original-assets.sha256.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ($manifest.Count -ne 9) { throw 'Expected exactly nine original PNG assets in the recorded manifest.' }
$prepared = @()
foreach ($entry in $manifest) {
    $relative = $entry.asset -replace '^Assets[\\/]Resources[\\/]Original[\\/]', ''
    if ($relative -eq $entry.asset) { throw "Unexpected original asset path: $($entry.asset)" }
    $source = [IO.Path]::GetFullPath((Join-Path (Join-Path $repositoryRoot 'assets') $relative))
    $destination = [IO.Path]::GetFullPath((Join-Path $originalRoot $relative))
    if (-not $destination.StartsWith($originalRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'An asset destination would escape Assets/Resources/Original.'
    }
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Original asset is missing: assets/$relative" }
    $actualHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $entry.sha256) { throw "Original asset changed since this visual study: assets/$relative" }
    $prepared += [PSCustomObject]@{ source = $source; destination = $destination; relative = $relative }
}

# Validate every source before copying any files, keeping preparation all-or-nothing.
if (-not $VerifyOnly) {
    foreach ($entry in $prepared) {
        New-Item -ItemType Directory -Force (Split-Path $entry.destination -Parent) | Out-Null
        Copy-Item -LiteralPath $entry.source -Destination $entry.destination -Force
    }
    Write-Host 'Prepared nine byte-identical original PNGs in Assets/Resources/Original. You can now open Unity.'
} else {
    Write-Host 'PASS: all nine repository assets exist and match the recorded SHA-256 hashes. No files were copied.'
}
