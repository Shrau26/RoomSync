@echo off
title RoomSync - Start All Services
color 0A
cd /d "%~dp0"

echo.
echo  ============================================
echo    RoomSync - Starting All Services
echo  ============================================
echo.

echo  Checking Node.js and Python...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js not found - download nodejs.org
    pause & exit
)
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python not found - download python.org
    pause & exit
)
echo  Both found OK!
echo.

echo  [1/2] Opening Flask ML API window...
start "RoomSync Flask API" cmd /k "title Flask ML API && cd /d "%~dp0flask-api" && pip install flask flask-cors scikit-learn pandas numpy joblib -q && echo. && echo Flask starting on http://localhost:5001 && echo. && python app.py"

echo  Waiting for Flask to start...
timeout /t 5 /nobreak >nul

echo  [2/2] Opening React Frontend window...
start "RoomSync React" cmd /k "title React Frontend && cd /d "%~dp0" && npm install && echo. && echo React starting on http://localhost:5173 && echo. && npm run dev"

echo  Waiting for React to start...
timeout /t 10 /nobreak >nul

echo.
echo  ============================================
echo    All services started!
echo    Open browser: http://localhost:5173
echo  ============================================
echo.
start http://localhost:5173
pause
