@echo off
title CTI Platform
echo.
echo  ============================================
echo     CTI Platform - Starting Server
echo  ============================================
echo.
echo  [*] Starting on http://localhost:8000
echo  [*] Press Ctrl+C to stop
echo.

:: Open browser after a short delay
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:8000"

:: Start the server
cd /d "C:\CTI\backend"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
