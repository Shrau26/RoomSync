@echo off
title RoomSync - Flask ML API
color 0A
cd /d "%~dp0flask-api"

echo.
echo  ========================================
echo    RoomSync Flask ML API
echo    URL: http://localhost:5001
echo  ========================================
echo.

echo  Checking Python...
python --version
if errorlevel 1 (
    echo.
    echo  ERROR: Python not found!
    echo  Download from: https://python.org
    echo  Make sure to check "Add Python to PATH" during install
    echo.
    pause
    exit
)

echo.
echo  Installing packages...
pip install flask flask-cors scikit-learn pandas numpy joblib --quiet
echo  Packages ready!
echo.
echo  Starting Flask API...
echo  URL: http://localhost:5001
echo  Press Ctrl+C to stop
echo.
python app.py
echo.
echo  Flask stopped. Press any key to close.
pause
