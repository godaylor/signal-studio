$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $repoRoot '.local/runtime'
$version = '22.22.2'
$archiveName = "node-v$version-win-x64.zip"
$nodeDirectory = Join-Path $runtimeRoot "node-v$version-win-x64"
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe'))) {
    $archivePath = Join-Path $runtimeRoot $archiveName
    Invoke-WebRequest "https://nodejs.org/dist/v$version/$archiveName" -OutFile $archivePath
    $manifest = (Invoke-WebRequest "https://nodejs.org/dist/v$version/SHASUMS256.txt").Content
    $expected = ($manifest -split "`n" | Where-Object { $_.Trim().EndsWith("  $archiveName") }) -split '\s+'
    if (-not $expected[0] -or (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash -ne $expected[0]) {
        throw 'Node archive SHA-256 does not match the official release manifest.'
    }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeRoot
}
& (Join-Path $nodeDirectory 'node.exe') --version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output 'Repository-local runtime is ready. Run ./scripts/pnpm.ps1 <command>.'
