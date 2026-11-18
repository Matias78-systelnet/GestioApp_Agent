[Setup]
AppId=GestioApp.Tray
AppName=GestioApp Agent
AppVersion=1.0.0
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

Source: "Enroll-Api.ps1"; DestDir: "{app}\Setup"; Flags: ignoreversion
Source: "enrollment.default.json"; DestDir: "{app}\Setup"; Flags: ignoreversion

[Icons]
Name: "{group}\GestioApp Agent"; Filename: "{app}\Tray\GestioApp.Tray.exe"

[Registry]
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "GestioAppTray"; ValueData: """{app}\Tray\GestioApp.Tray.exe"""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\Tray\GestioApp.Tray.exe"; Description: "Abrir GestioApp Agent"; Flags: nowait postinstall skipifsilent runasoriginaluser

[Code]
var
  EnrollmentPage: TInputQueryWizardPage;
  KeepExisting: Boolean;

function HasExistingApi(): Boolean;
var Token, Config: AnsiString;
begin
  Result := LoadStringFromFile(ExpandConstant('{commonappdata}\GestioApp\Config\api-token.txt'), Token)
    and (Length(Trim(Token)) > 0)
    and LoadStringFromFile(ExpandConstant('{commonappdata}\GestioApp\Config\agent.json'), Config);
  if Result then
    Result := (Pos('"apiEnabled": true', Config) > 0) or (Pos('"apiEnabled":true', Config) > 0);
end;

procedure InitializeWizard();
begin
  KeepExisting := HasExistingApi();
  EnrollmentPage := CreateInputQueryPage(wpSelectDir, 'Vincular equipo con GestioApp',
    'Ingrese el código generado en la web de administración.',
    'En Activos, pulse Añadir equipo y copie su código. Se necesita conexión al servidor y un certificado HTTPS de confianza.');
  EnrollmentPage.Add('Código de vinculación:', True);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := (PageID = EnrollmentPage.ID) and KeepExisting;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var Code: String; I: Integer;
begin
  Result := True;
  if (CurPageID = EnrollmentPage.ID) and not KeepExisting then begin
    Code := Uppercase(Trim(EnrollmentPage.Values[0]));
    StringChangeEx(Code, '-', '', True);
    StringChangeEx(Code, ' ', '', True);
    Result := Length(Code) = 32;
    for I := 1 to Length(Code) do
      if Pos(Code[I], '0123456789ABCDEF') = 0 then Result := False;
    if not Result then MsgBox('Ingrese el código completo generado en la web (32 caracteres, con o sin guiones).', mbError, MB_OK);
    EnrollmentPage.Values[0] := Code;
  end;
end;

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
  if WizardSilent and not KeepExisting then begin
    Result := 'La primera vinculación requiere ejecutar el asistente e ingresar el código.';
    Exit;
  end;
  ExtractTemporaryFile('ServiceSetup.ps1');
  if not RunServiceScript(ExpandConstant('{tmp}\ServiceSetup.ps1'), 'Stop') then
    Result := 'No se pudo detener GestioApp Agent. Cierra la aplicación y revisa el servicio antes de continuar.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var ExitCode: Integer; ErrorText: AnsiString; InputPath: String; Ok: Boolean;
begin
  if CurStep = ssPostInstall then begin
    if not RunServiceScript(ExpandConstant('{app}\Setup\ServiceSetup.ps1'), 'Prepare') then
      RaiseException('No se pudieron preparar las carpetas y permisos del agente.');
    if not KeepExisting then begin
      InputPath := ExpandConstant('{commonappdata}\GestioApp\Config\enrollment-input.txt');
      if not SaveStringToFile(InputPath, EnrollmentPage.Values[0], False) then
        RaiseException('No se pudo preparar la vinculación.');
      ExitCode := -1;
      try
        Ok := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
          '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\Setup\Enroll-Api.ps1') + '"',
          '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
      finally
        DeleteFile(InputPath);
        EnrollmentPage.Values[0] := '';
      end;
      if not Ok or (ExitCode <> 0) then begin
        ErrorText := 'No se pudo vincular el equipo.';
        LoadStringFromFile(ExpandConstant('{commonappdata}\GestioApp\Config\enrollment-error.txt'), ErrorText);
        RaiseException(ErrorText + #13#10 + 'Los archivos quedaron instalados. Vuelva a ejecutar el instalador para reintentar.');
      end;
    end;
    if not RunServiceScript(ExpandConstant('{app}\Setup\ServiceSetup.ps1'), 'Install') then
      RaiseException('El servicio no pudo verificarse. Revise el Visor de eventos. La vinculación se conserva para reintentar.');
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := RunServiceScript(ExpandConstant('{app}\Setup\ServiceSetup.ps1'), 'Remove');
  if not Result then
    MsgBox('No se pudo detener o eliminar el servicio. La desinstalación se canceló para evitar archivos en uso.', mbError, MB_OK);
end;
