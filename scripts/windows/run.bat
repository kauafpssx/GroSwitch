@echo off
REM =============================================
REM  GroSwitch - Windows Run Script
REM =============================================
REM  Starts the GroSwitch gateway server.
REM
REM  Usage:
REM    scripts\windows\run.bat         Development mode
REM    scripts\windows\run.bat --prod  Production mode
REM =============================================

setlocal enabledelayedexpansion

cd /d "%~dp0..\.."

REM ── Check prerequisites ─────────────────────
where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL]  Bun is not installed. Run scripts\windows\install.bat first.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [FAIL]  .env file not found. Run scripts\windows\install.bat first.
    pause
    exit /b 1
)

REM ── Parse mode ──────────────────────────────
set MODE=%1
if "%MODE%"=="--prod" set MODE=prod
if "%MODE%"=="" set MODE=dev

if "%MODE%"=="prod" (
    echo [INFO]  Starting in PRODUCTION mode (single port)...
    echo [INFO]  Building all packages and starting server on port 8400...
    call bun run start
) else (
    echo [INFO]  Starting in DEVELOPMENT mode (two ports)...
    echo [INFO]  Backend API ^>^> http://localhost:8400
    echo [INFO]  Frontend UI  ^>^> http://localhost:5173  (proxies API calls)
    echo.
    call bun run dev
)
