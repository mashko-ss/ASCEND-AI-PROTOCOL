@echo off
setlocal
cd /d "%~dp0"
echo Starting ASCEND AI PROTOCOL from:
echo %CD%
call node build.js
if errorlevel 1 exit /b %errorlevel%
call node scripts\dev-server.mjs
