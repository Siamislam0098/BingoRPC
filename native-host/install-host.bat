@echo off
setlocal
set "MANIFEST=%~dp0com.bingorpc.host.json"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install the LTS version from nodejs.org, then run this again.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\@xhayper" (
  echo Packages are missing. Run "npm install" in this folder first.
  pause
  exit /b 1
)

reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.bingorpc.host" /ve /t REG_SZ /d "%MANIFEST%" /f
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.bingorpc.host" /ve /t REG_SZ /d "%MANIFEST%" /f

echo.
echo Done. Helper registered for Edge and Chrome.
echo Now restart the browser fully, then reload the extension.
pause
