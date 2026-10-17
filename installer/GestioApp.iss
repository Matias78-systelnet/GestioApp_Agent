[Setup]
AppId=GestioApp.Tray
AppName=GestioApp Agent
AppVersion=0.3.0
DefaultDirName={autopf}\GestioApp
DefaultGroupName=GestioApp
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\publish\installer
OutputBaseFilename=GestioApp-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\GestioApp.Tray\Assets\gestioapp.ico
UninstallDisplayIcon={app}\Tray\GestioApp.Tray.exe
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "..\publish\tray\*"; DestDir: "{app}\Tray"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\publish\agent\*"; DestDir: "{app}\Agent"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "ServiceSetup.ps1"; DestDir: "{app}\Setup"; Flags: ignoreversion
Source: "agent.default.json"; DestDir: "{app}\Setup"; Flags: ignoreversion
Source: "ServiceSetup.ps1"; Flags: dontcopy

[Icons]
Name: "{group}\GestioApp Agent"; Filename: "{app}\Tray\GestioApp.Tray.exe"

[Registry]
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "GestioAppTray"; ValueData: """{app}\Tray\GestioApp.Tray.exe"""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\Tray\GestioApp.Tray.exe"; Description: "Abrir GestioApp Agent"; Flags: nowait postinstall skipifsilent runasoriginaluser

[Code]
function RunServiceScript(ScriptPath, Action: String): Boolean;
var ExitCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + '" -Action ' + Action,
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  if Result then Result := ExitCode = 0;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  ExtractTemporaryFile('ServiceSetup.ps1');
  if not RunServiceScript(ExpandConstant('{tmp}\ServiceSetup.ps1'), 'Stop') then
    Result := 'No se pudo detener GestioApp Agent. Cierra la aplicación y revisa el servicio antes de continuar.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    if not RunServiceScript(ExpandConstant('{app}\Setup\ServiceSetup.ps1'), 'Install') then
      RaiseException('Los archivos se copiaron, pero el servicio no pudo verificarse. Revisa el Visor de eventos y ejecuta ServiceSetup.ps1 -Action Install como administrador.');
end;

function InitializeUninstall(): Boolean;
begin
  Result := RunServiceScript(ExpandConstant('{app}\Setup\ServiceSetup.ps1'), 'Remove');
  if not Result then
    MsgBox('No se pudo detener o eliminar el servicio. La desinstalación se canceló para evitar archivos en uso.', mbError, MB_OK);
end;
