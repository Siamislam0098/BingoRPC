@echo off
reg delete "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.bingorpc.host" /f
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.bingorpc.host" /f
echo Helper unregistered.
pause
