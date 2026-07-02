@echo off
rem Double-click this file to start the Client Calendar app and open it in
rem your browser. Keep the black window open while you use the app; closing
rem it stops the app.
title Client Calendar - keep this window open
cd /d "%~dp0"
echo Starting the Client Calendar... your browser will open in a moment.
start "" /b cmd /c "timeout /t 12 /nobreak >nul && start http://localhost:3000"
call npm run dev
pause
