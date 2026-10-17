$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
foreach ($project in @('Agent', 'Tray')) {
    dotnet publish ".\GestioApp.$project\GestioApp.$project.csproj" -c Release -r win-x64 --self-contained true -o ".\publish\$($project.ToLower())"
    if ($LASTEXITCODE -ne 0) { throw "Falló la publicación de $project" }
}
Write-Host 'Publicación lista. Abre installer\GestioApp.iss con Inno Setup 6 y pulsa Compile.'
