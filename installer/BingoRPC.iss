; Inno Setup script. Built by the GitHub workflow (see .github/workflows/release.yml).
; Input files are expected in ..\native-host\dist (the .exe and config.json) and this folder (manifest).
#define AppVersion GetEnv("BINGORPC_VERSION")
#if AppVersion == ""
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{B1A6C0D1-5E0F-4C2B-9B7A-3D2F6A8E4C11}
AppName=BingoRPC Helper
AppVersion={#AppVersion}
AppPublisher=BingoGames
DefaultDirName={localappdata}\BingoRPC
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\native-host\dist
OutputBaseFilename=BingoRPC-Helper-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=BingoRPC Helper
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "..\native-host\dist\BingoRPC-host.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\native-host\dist\config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "com.bingorpc.host.json"; DestDir: "{app}"; Flags: ignoreversion

; The browser looks here to find the helper. Per-user keys: no admin rights needed.
[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\com.bingorpc.host"; ValueType: string; ValueData: "{app}\com.bingorpc.host.json"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.bingorpc.host"; ValueType: string; ValueData: "{app}\com.bingorpc.host.json"; Flags: uninsdeletekey

[UninstallDelete]
Type: files; Name: "{app}\host.log"

[Code]
procedure StopHelper;
var
  code: Integer;
begin
  // The browser keeps the helper running. Stop it so the file can be replaced or removed.
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM BingoRPC-host.exe', '', SW_HIDE, ewWaitUntilTerminated, code);
end;

function InitializeSetup(): Boolean;
begin
  StopHelper;
  Result := True;
end;

function InitializeUninstall(): Boolean;
begin
  StopHelper;
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    MsgBox('BingoRPC Helper is installed.' #13#10#13#10 +
           'Next: fully close Edge/Chrome and open it again, then open the BingoRPC extension.' #13#10 +
           'Keep the Discord desktop app open.', mbInformation, MB_OK);
end;
