@echo off
title CTI Platform Launcher
echo.
echo  ============================================
echo     CTI Platform - Starting Services
echo  ============================================
echo.

:: Use short path to avoid the & in L&D breaking cmd
set "PROJECT=C:\Users\Phinehas_acs\Downloads\L&D\CTI"

:: Start backend in a new window
echo  [*] Starting Backend (FastAPI) on port 8000...
start "CTI Backend" cmd /k "cd /d "%PROJECT%\backend" && python -m uvicorn main:app --reload"

:: Small delay to let backend start first
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
echo  [*] Starting Frontend (Vite) on port 5173...
start "CTI Frontend" cmd /k "cd /d "%PROJECT%\frontend" && npx vite"

:: Wait for frontend to spin up
timeout /t 5 /nobreak >nul

:: Open browser
echo  [*] Opening browser...
start http://localhost:5173

echo.
echo  ============================================
echo     Both servers are running!
echo     Backend:  http://localhost:8000
echo     Frontend: http://localhost:5173
echo     Close the server windows to stop.
echo  ============================================
echo.
pause
