param([string]$EditorRoot = 'C:\Program Files\Unity\Hub\Editor\2022.3.44f1\Editor')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$editorData = Join-Path $EditorRoot 'Data'
$assemblyPaths = @(
    Get-ChildItem (Join-Path $editorData 'Managed') -Filter '*.dll' -File
    Get-ChildItem (Join-Path $editorData 'Managed/UnityEngine') -Filter '*.dll' -File
    Get-ChildItem (Join-Path $editorData 'Resources/PackageManager/ProjectTemplates/libcache/com.unity.template.universal-2d-2.1.2/ScriptAssemblies') -Filter '*.dll' -File
    Get-Item (Join-Path $editorData 'NetStandard/ref/2.1.0/netstandard.dll')
)
$references = $assemblyPaths | ForEach-Object { '/reference:' + $_.FullName }
$sources = @(
    (Join-Path $projectRoot 'Assets/Scripts/RhizosphereDemo.cs'),
    (Join-Path $projectRoot 'Assets/Editor/RhizosphereBuild.cs')
)
$scratch = Join-Path $projectRoot 'Temp/ReferenceCompile'
New-Item -ItemType Directory -Force $scratch | Out-Null
$outputPath = Join-Path $scratch 'RhizosphereReference.dll'
$logPath = Join-Path $projectRoot 'Evidence/csharp-reference-check.log'
& (Join-Path $editorData 'NetCoreRuntime/dotnet.exe') (Join-Path $editorData 'DotNetSdkRoslyn/csc.dll') /nologo /noconfig /nostdlib+ /target:library /langversion:9 (('/out:' + $outputPath)) @references @sources 2>&1 | Tee-Object $logPath
$compilerExit = $LASTEXITCODE
if ($compilerExit -ne 0) { throw "Reference C# compilation failed with exit code $compilerExit" }
@'
PASS: Runtime and editor C# sources compile against installed Unity 2022.3.44f1 managed assemblies and its Universal-2D template's cached URP assemblies.
Scope: syntax, types and referenced managed API compatibility only.
This is NOT a Unity Editor import, package resolution, shader compilation, player build or GPU render test.
The actual Unity Editor batchmode attempt stopped at invalid licensing; see unity-batchmode-license.log.
'@ | Set-Content $logPath -Encoding UTF8
Get-Content $logPath
