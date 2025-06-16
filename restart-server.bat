@echo off
echo Restarting Music Splitting Server...
taskkill /im node.exe /f >nul 2>&1
cd /d %~dp0
start cmd /k "npm run dev"
echo Server restarting! Please wait a moment for it to initialize.
timeout /t 5
exit
