param(
    [Parameter(Mandatory=$true)][uri]$InventoryEndpoint,
    [Parameter(Mandatory=$true)][uri]$HeartbeatEndpoint
)
$ErrorActionPreference = 'Stop'
if ($InventoryEndpoint.Scheme -ne 'https' -or $HeartbeatEndpoint.Scheme -ne 'https') { throw 'Se requiere HTTPS.' }
$dir = Join-Path $env:ProgramData 'GestioApp\Config'
$configPath = Join-Path $dir 'agent.json'
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$secret = Read-Host 'Token Bearer individual para este dispositivo' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ([string]::IsNullOrWhiteSpace($token)) { throw 'Token vacío.' }
    [IO.File]::WriteAllText((Join-Path $dir 'api-token.txt'), $token)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    $token = $null
    $secret.Dispose()
}
$config.inventoryEndpoint = $InventoryEndpoint.AbsoluteUri
$config.heartbeatEndpoint = $HeartbeatEndpoint.AbsoluteUri
$config.apiEnabled = $true
$config | ConvertTo-Json | Set-Content $configPath -Encoding UTF8
Restart-Service GestioAppAgent
Write-Host 'API configurada. Comprueba el estado del envío en la ventana.'
