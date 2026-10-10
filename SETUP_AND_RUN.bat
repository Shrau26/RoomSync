@echo off
title RoomSync - First Time Setup
color 0B
cd /d "%~dp0"

echo.
echo  ============================================
echo    RoomSync - First Time Setup
echo    Run this ONCE before using the app
echo  ============================================
echo.

echo [1/4] Installing Python packages...
pip install flask flask-cors scikit-learn pandas numpy joblib -q
echo Done!

echo.
echo [2/4] Generating student dataset (1000 profiles)...
python flask-api/data/generate_dataset.py
echo Done!

echo.
echo [3/4] Training AI models (Random Forest + KMeans)...
python flask-api/models/train_model.py
echo Done!

echo.
echo [4/4] Installing Node packages...
npm install
echo Done!

echo.
echo  ============================================
echo    Setup Complete!
echo    Now double-click START_ALL.bat to run
echo  ============================================
echo.
pause
