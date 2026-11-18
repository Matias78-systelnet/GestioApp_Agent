# Called elevated by the installer. Never put codes or tokens on a command line.
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:ProgramData 'GestioApp'
$dir = Join-Path $root 'Config'
$inputPath = Join-Path $dir 'enrollment-input.txt'
$errorPath = Join-Path $dir 'enrollment-error.txt'
$pendingPath = Join-Path $dir 'enrollment-pending.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Save-Atomic([string]$Path, [string]$Value) {
    $temp = $Path + '.new'
    [IO.File]::WriteAllText($temp, $Value, $utf8)
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temp, $Path, $null) }
    else { [IO.File]::Move($temp, $Path) }
}
function Random-Hex {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
function Hash-Text([string]$Value) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
try {
    Remove-Item $errorPath -ErrorAction SilentlyContinue
    $code = ([IO.File]::ReadAllText($inputPath) -replace '[\s-]', '').ToUpperInvariant()
    if ($code -notmatch '^[A-F0-9]{32}$') { throw 'El codigo debe tener 32 caracteres hexadecimales; puede incluir guiones.' }
    $defaults = Get-Content "$PSScriptRoot\enrollment.default.json" -Raw | ConvertFrom-Json
    $server = [uri]$defaults.serverUrl
    if (!$server.IsAbsoluteUri -or $server.Scheme -ne 'https' -or $server.UserInfo -or $server.AbsolutePath -ne '/' -or $server.Query -or $server.Fragment) {
        throw 'La direccion del servidor debe ser un origen HTTPS valido.'
    }
    $origin = $server.GetLeftPart([UriPartial]::Authority)
    $idPath = Join-Path $root 'State\device-id.txt'
    if (!(Test-Path $idPath)) { Save-Atomic $idPath ([guid]::NewGuid().ToString()) }
    $deviceId = ([guid]([IO.File]::ReadAllText($idPath).Trim())).ToString()
    $codeHash = Hash-Text $code
    $pending = $null
    if (Test-Path $pendingPath) { $pending = Get-Content $pendingPath -Raw | ConvertFrom-Json }
    if (!$pending -or $pending.codeHash -ne $codeHash -or $pending.serverUrl -ne $origin -or $pending.deviceId -ne $deviceId) {
        $pending = [pscustomobject]@{ codeHash = $codeHash; serverUrl = $origin; deviceId = $deviceId;
            requestId = [guid]::NewGuid().ToString(); recoverySecret = Random-Hex }
        Save-Atomic $pendingPath ($pending | ConvertTo-Json)
    }
    $body = @{ code = $code; deviceId = $deviceId; computerName = $env:COMPUTERNAME;
        requestId = $pending.requestId; recoverySecret = $pending.recoverySecret } | ConvertTo-Json
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        # No redirects and no TLS validation bypass. Secrets go only to the configured origin.
        $receipt = Invoke-RestMethod -Uri "$origin/api/agents/enroll" -Method Post -Body $body `
            -ContentType 'application/json' -TimeoutSec 25 -MaximumRedirection 0
    } catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        switch ($status) {
            403 { throw 'Codigo invalido o anulado. Solicite uno nuevo al administrador.' }
            409 { throw 'Codigo usado, equipo ya vinculado o recuperacion vencida. Consulte al administrador.' }
            410 { throw 'Codigo vencido. Genere otro desde la web.' }
            422 { throw 'Formato de solicitud incorrecto. Compruebe la version del servidor.' }
            429 { throw 'Demasiados intentos. Espere antes de reintentar.' }
            503 { throw 'La vinculacion no esta configurada en el servidor.' }
            default { throw "No se pudo vincular (HTTP $status). Revise red, certificado y backend. Puede reintentar con el mismo codigo." }
        }
    }
    if ($receipt.deviceId -ne $deviceId -or $receipt.token -notmatch '^[a-f0-9]{64}$' -or !$receipt.apiEnabled) {
        throw 'Respuesta de vinculacion invalida.'
    }
    foreach ($pair in @(@('inventoryEndpoint', '/api/agents/inventory'), @('heartbeatEndpoint', '/api/agents/heartbeat'))) {
        if ($receipt.($pair[0]) -ne ($origin + $pair[1])) { throw 'El servidor devolvio endpoints inesperados.' }
    }
    $configPath = Join-Path $dir 'agent.json'
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    $config.apiEnabled = $true
    $config.inventoryEndpoint = $receipt.inventoryEndpoint
    $config.heartbeatEndpoint = $receipt.heartbeatEndpoint
    $config.inventorySeconds = 300
    $config.heartbeatSeconds = 60
    # Write the token first, then activate the API; a failure keeps recovery state for a retry.
    Save-Atomic (Join-Path $dir 'api-token.txt') $receipt.token
    Save-Atomic $configPath ($config | ConvertTo-Json -Depth 10)
    Remove-Item $pendingPath -ErrorAction SilentlyContinue
    exit 0
} catch {
    # Only our sanitized errors are user-visible; never persist request bodies or tokens.
    $message = $_.Exception.Message
    if ($_.Exception -isnot [System.Management.Automation.RuntimeException]) {
        $message = 'No se pudo guardar o leer la configuracion. Revise permisos y reintente el instalador.'
    }
    [IO.File]::WriteAllText($errorPath, $message, $utf8)
    exit 1
} finally {
    Remove-Item $inputPath -ErrorAction SilentlyContinue
}
