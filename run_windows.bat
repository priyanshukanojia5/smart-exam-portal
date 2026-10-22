@echo off
cd /d "%~dp0"

echo ======================================================
echo           Examly - Online Examination System          
echo ======================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: Node.js is required to run this system.
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing required packages...
  npm install
)

echo Starting server at http://localhost:3000 ...
npm start
pause
