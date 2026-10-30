@echo off
title GSTiQ - ITC and RCM Suite
cd /d "%~dp0"
echo.
echo  GSTiQ - AI-powered ITC and RCM Suite (ICAI Advanced IT project)
echo  ----------------------------------------------------------------
echo  Installing Python packages (needed only the first time)...
python -m pip install --quiet -r requirements.txt
if errorlevel 1 (
  echo.
  echo  Python was not found. Install Python 3.10+ from python.org, or simply
  echo  double-click OPEN_ME_GSTiQ_App.html - it works without Python.
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 4 >nul & start http://127.0.0.1:5000"
python backend\app.py
pause
