@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Start-DrawPhaser.ps1"
if errorlevel 1 (
  echo.
  echo Failed to start DrawPhaser.
  pause
  exit /b 1
)

exit /b 0
