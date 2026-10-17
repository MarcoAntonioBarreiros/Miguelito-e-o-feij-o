param(
    [ValidateSet('Prepare', 'Windows', 'WebGL')][string]$Target = 'Prepare',
    [string]$UnityExe = 'C:\Program Files\Unity\Hub\Editor\2022.3.44f1\Editor\Unity.exe'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$method = switch ($Target) {
    'Prepare' { 'RhizosphereBuild.Prepare' }
    'Windows' { 'RhizosphereBuild.BuildWindows' }
    'WebGL' { 'RhizosphereBuild.BuildWebGL' }
}
$logPath = Join-Path $projectRoot ('Evidence/editor-' + $Target + '.log')
$arguments = @('-batchmode', '-quit', '-nographics', '-projectPath', ('"' + $projectRoot + '"'), '-executeMethod', $method, '-logFile', ('"' + $logPath + '"'))
$process = Start-Process -FilePath $UnityExe -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if (Test-Path $logPath) { Get-Content $logPath -Tail 35 }
if ($process.ExitCode -ne 0) { throw "Unity exited with code $($process.ExitCode). Read $logPath" }
Write-Host "Unity operation completed. Evidence: $logPath"
