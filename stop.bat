@echo off
echo  Stopping CTI Platform...
taskkill /FI "WINDOWTITLE eq CTI Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CTI Frontend*" /F >nul 2>&1
echo  Done. All servers stopped.
pause
