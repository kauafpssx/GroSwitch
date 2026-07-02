@echo off
REM =============================================
REM  GroSwitch - Windows Installation Script
REM =============================================
REM  This script installs all dependencies
REM  and initializes the project on Windows.
REM
REM  Usage:
REM    scripts\windows\install.bat
REM =============================================

setlocal enabledelayedexpansion

cd /d "%~dp0..\.."

echo [INFO]  Welcome to GroSwitch Setup
echo [INFO]  Root Directory: %cd%
echo.

REM ── 1. Check for Bun ────────────────────────
echo [INFO]  Checking prerequisites...

where bun >nul 2>&1
if %errorlevel% equ 0 (
    bun --version > "%TEMP%\bun_ver.tmp"
    set /p BUN_VER=<"%TEMP%\bun_ver.tmp"
    del "%TEMP%\bun_ver.tmp" 2>nul
    echo [OK]    Bun v%BUN_VER% is installed
) else (
    echo [WARN]  Bun is not installed.
    echo [INFO]  Installing Bun via PowerShell...
    powershell -Command "& {[System.Environment]::SetEnvironmentVariable('BUN_INSTALL', '%USERPROFILE%\.bun', 'User')}"
    powershell -Command "iwr https://bun.sh/install.ps1 -useb | iex"
    echo [INFO]  Please restart your terminal and re-run this script after installation.
    pause
    exit /b 1
)

REM ── 2. Install dependencies ─────────────────
echo [INFO]  Installing project dependencies with Bun...
call bun install
if %errorlevel% neq 0 (
    echo [FAIL]  Failed to install dependencies
    pause
    exit /b 1
)
echo [OK]    Dependencies installed

REM ── 3. Set up environment file ──────────────
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env
        echo [WARN]  .env file created from .env.example
        echo [WARN]  ^>^>^> Edit .env and set your MASTER_API_KEY and MASTER_ENCRYPTION_KEY ^<^<^<
    ) else (
        echo [WARN]  .env.example not found. Creating minimal .env...
        (
            echo MASTER_API_KEY=change-me-to-a-secret-key
            echo MASTER_ENCRYPTION_KEY=change-me-to-at-least-32-chars-long
            echo PORT=8400
            echo DATABASE_URL=file:./dev.db
            echo GROQ_BASE_URL=https://api.groq.com/openai/v1
            echo KEY_MONITOR_INTERVAL_MS=60000
        ) > .env
        echo [WARN]  ^>^>^> Edit .env and set your MASTER_API_KEY and MASTER_ENCRYPTION_KEY ^<^<^<
    )
) else (
    echo [OK]    .env file already exists
)

REM ── 4. Generate Prisma client and push schema ─
echo [INFO]  Generating Prisma client...
call bun run db:generate
if %errorlevel% neq 0 (
    echo [FAIL]  Failed to generate Prisma client
    pause
    exit /b 1
)
echo [OK]    Prisma client generated

echo [INFO]  Pushing database schema...
call bun run db:push
if %errorlevel% neq 0 (
    echo [FAIL]  Failed to push database schema
    pause
    exit /b 1
)
echo [OK]    Database schema pushed

REM ── 5. Build all packages ──────────────────
echo [INFO]  Building all packages...
call bun run build
if %errorlevel% neq 0 (
    echo [FAIL]  Build failed
    pause
    exit /b 1
)
echo [OK]    Build completed

REM ── Summary ─────────────────────────────────
echo.
echo ============================================
echo   GroSwitch installation complete!
echo ============================================
echo.
echo   Next steps:
echo     1. Edit .env with your credentials
echo     2. Run:  scripts\windows\run.bat
echo     3. Open http://localhost:8400
echo.
pause
