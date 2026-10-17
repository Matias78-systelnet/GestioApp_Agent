param([ValidateSet('Stop','Install','Remove')][string]$Action = 'Install')
$ErrorActionPreference = 'Stop'
$serviceName = 'GestioAppAgent'
$root = Join-Path $env:ProgramData 'GestioApp'
function Stop-Agent {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne 'Stopped') {
        Stop-Service -Name $serviceName -ErrorAction Stop
        $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
    }
}
function Native([string[]]$Arguments) {
    & "$env:SystemRoot\System32\sc.exe" @Arguments
    if ($LASTEXITCODE -ne 0) { throw "sc.exe fallo: $LASTEXITCODE" }
}
function Set-DirectoryAcl([string]$Path, [bool]$State, [bool]$Public) {
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $entries = @(@('S-1-5-18','FullControl'), @('S-1-5-32-544','FullControl'))
    if ($State) { $entries += ,@('S-1-5-19','Modify') }
    else { $entries += ,@('S-1-5-19','ReadAndExecute') }
    if ($Public) { $entries += ,@('S-1-5-32-545','ReadAndExecute') }
    foreach ($entry in $entries) {
        $sid = [System.Security.Principal.SecurityIdentifier]::new($entry[0])
        $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($sid, $entry[1], 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
try {
    if ($Action -eq 'Stop') { Stop-Agent; exit 0 }
    if ($Action -eq 'Remove') {
        Stop-Agent
        if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) { Native @('delete', $serviceName) }
        # Conserva identidad/configuración para reinstalación. No elimina dominio ni WireGuard.
        exit 0
    }
    Stop-Agent
    foreach ($dir in @($root, "$root\Config", "$root\State", "$root\ActivityQueue")) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Set-DirectoryAcl $root $false $true
    Set-DirectoryAcl "$root\Config" $false $false
    Set-DirectoryAcl "$root\State" $true $true
    Set-DirectoryAcl "$root\ActivityQueue" $true $false
    if (!(Test-Path "$root\Config\agent.json")) {
        Copy-Item "$PSScriptRoot\agent.default.json" "$root\Config\agent.json"
    }
    if (!(Test-Path "$root\Config\api-token.txt")) {
        New-Item -ItemType File "$root\Config\api-token.txt" | Out-Null
    }
    $config = Get-Content "$root\Config\agent.json" -Raw | ConvertFrom-Json
    if ($config.inventorySeconds -lt 30 -or $config.heartbeatSeconds -lt 15) { throw 'Intervalos no validos en agent.json' }
    $exe = Join-Path (Split-Path $PSScriptRoot -Parent) 'Agent\GestioApp.Agent.exe'
    if (!(Test-Path $exe)) { throw "Falta ejecutable: $exe" }
    $quotedExe = '"' + $exe + '"'
    $existing = Get-CimInstance Win32_Service -Filter "Name='$serviceName'"
    if ($existing) {
        $result = Invoke-CimMethod -InputObject $existing -MethodName Change -Arguments @{
            PathName = $quotedExe; StartMode = 'Automatic'; StartName = 'NT AUTHORITY\LocalService'; StartPassword = ''
        }
    } else {
        $result = Invoke-CimMethod -ClassName Win32_Service -MethodName Create -Arguments @{
            Name = $serviceName; DisplayName = 'GestioApp Agent'; PathName = $quotedExe
            ServiceType = [byte]16; ErrorControl = [byte]1; StartMode = 'Automatic'
            DesktopInteract = $false; StartName = 'NT AUTHORITY\LocalService'; StartPassword = ''
        }
    }
    if ($result.ReturnValue -ne 0) { throw "No se pudo registrar servicio: codigo $($result.ReturnValue)" }
    Native @('failure', $serviceName, 'reset=', '86400', 'actions=', 'restart/10000/restart/30000/restart/60000')
    Native @('failureflag', $serviceName, '1')
    Start-Service $serviceName
    (Get-Service $serviceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
    # Verifica señal del proceso, no solo estado "Running" del SCM.
    $started = [DateTimeOffset]::UtcNow
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ((Get-Service $serviceName).Status -ne 'Running') { throw 'El servicio se detuvo al iniciar. Revisa el Visor de eventos.' }
        if (Test-Path "$root\State\state.json") {
            try {
                $state = Get-Content "$root\State\state.json" -Raw | ConvertFrom-Json
                if ([DateTimeOffset]::Parse($state.serviceSeenAtUtc) -ge $started.AddSeconds(-10)) { $ready = $true; break }
            } catch { }
        }
        Start-Sleep -Seconds 2
    }
    if (!$ready) { throw 'No hubo actividad reciente del servicio. Revisa permisos y Visor de eventos.' }
    exit 0
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
