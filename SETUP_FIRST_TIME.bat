@echo off
title RoomSync - First Time Setup
color 0E
cd /d "%~dp0"

echo.
echo  ============================================
echo    RoomSync - First Time Setup
echo  ============================================
echo.

echo  Checking requirements...
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js NOT found
    echo      Download: https://nodejs.org  choose LTS version
    echo.
) else (
    echo  [OK] Node.js found
)

python --version >nul 2>&1
if errorlevel 1 (
    echo  [X] Python NOT found
    echo      Download: https://python.org
    echo      IMPORTANT: Check "Add Python to PATH" during install
    echo.
) else (
    echo  [OK] Python found
)

echo.
echo  Installing Node packages...
npm install
echo  Done!
echo.

echo  Installing Python packages...
pip install flask flask-cors scikit-learn pandas numpy joblib
echo  Done!
echo.

echo  ============================================
echo    Setup complete!
echo.
echo    NEXT STEP - Configure Firebase:
echo    1. Open src\firebase\config.js
echo    2. Replace YOUR_* with your Firebase keys
echo    3. Get keys from: console.firebase.google.com
echo.
echo    TO RUN: Double-click START_ALL.bat
echo  ============================================
echo.
pause
