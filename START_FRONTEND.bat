@echo off
title RoomSync - React Frontend
color 0B
cd /d "%~dp0"

echo.
echo  ========================================
echo    RoomSync React Frontend
echo    URL: http://localhost:5173
echo  ========================================
echo.

echo  Checking Node.js...
node --version
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js not found!
    echo  Download from: https://nodejs.org
    echo.
    pause
    exit
)

echo.
if not exist "node_modules" (
    echo  Installing packages - first time only, takes 1-2 min...
    npm install
    echo.
)

echo  Starting React app...
echo  URL: http://localhost:5173
echo  Press Ctrl+C to stop
echo.
npm run dev
echo.
echo  React stopped. Press any key to close.
pause
