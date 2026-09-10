$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeDirectory = Join-Path $repoRoot '.local/runtime/node-v22.22.2-win-x64'
$nodeExecutable = Join-Path $nodeDirectory 'node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'Run ./scripts/setup-runtime.ps1 first.' }
$previousPath = $env:PATH
$previousCorepack = $env:COREPACK_HOME
try {
    $env:PATH = "$nodeDirectory;$previousPath"
    $env:COREPACK_HOME = Join-Path $repoRoot '.local/corepack'
    & $nodeExecutable (Join-Path $nodeDirectory 'node_modules/corepack/dist/corepack.js') pnpm @args
    $commandExitCode = $LASTEXITCODE
} finally {
    $env:PATH = $previousPath
    $env:COREPACK_HOME = $previousCorepack
}
exit $commandExitCode
