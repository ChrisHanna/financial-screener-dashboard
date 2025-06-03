@echo off
REM 🚀 Bitunix Trading Service - Windows Startup Script
REM Change to the script directory
cd /d "%~dp0"

echo ====================================================
echo 🚀 BITUNIX CRYPTOCURRENCY TRADING SERVICE
echo ====================================================
echo Starting trading service...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found! Please install Python 3.8+
    echo.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️ Environment file not found!
    echo.
    if exist ".env.template" (
        echo 📋 Please copy .env.template to .env and configure:
        echo    copy .env.template .env
        echo.
        echo 🔑 Required settings:
        echo    - DATABASE_URL (same as Discord bot)
        echo    - BITUNIX_API_KEY (from bitunix.com)
        echo    - BITUNIX_API_SECRET (from bitunix.com)
        echo.
        pause
        exit /b 1
    ) else (
        echo ❌ No .env.template found either!
        pause
        exit /b 1
    )
)

REM Install dependencies
echo 📦 Installing dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    echo Try running manually: pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Environment check complete!
echo 🚀 Starting Bitunix Trading Engine...
echo 📝 Press Ctrl+C to stop the service
echo.

REM Run the trading service
python start_trading.py

echo.
echo ⏹️ Trading service stopped
pause