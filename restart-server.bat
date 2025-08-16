@echo off
setlocal
title Restart Music Splitting Dev Server

echo [restart] Stopping existing dev processes (server + vite)...
rem Kill only Node processes related to this project (server/index.js or vite)
powershell -NoProfile -Command "^
	$procs = Get-CimInstance Win32_Process ^| Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -match 'server\\index.js' -or $_.CommandLine -match 'vite') }; ^
	foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }" >nul 2>&1

cd /d %~dp0
echo [restart] Launching dev server detached (minimized window)...
rem Start npm run dev in a detached, minimized window so this script can exit immediately
powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c npm run dev' -WindowStyle Minimized"

echo [restart] Done. Dev server is starting in background.
endlocal
exit /b 0
