@echo off
REM 🚀 Bitunix Trading Service Quick Setup
cd /d "%~dp0"

echo ====================================================
echo 🛠️ BITUNIX TRADING SERVICE SETUP
echo ====================================================
echo.

REM Check if .env already exists
if exist ".env" (
    echo ✅ Environment file already exists
    echo.
    choice /C YN /M "Do you want to overwrite the existing .env file? (Y/N)"
    if errorlevel 2 goto :existing_env
)

REM Copy template to .env
if exist ".env.template" (
    copy ".env.template" ".env" >nul
    echo ✅ Created .env file from template
    echo.
    echo 📝 IMPORTANT: Please edit .env with your settings:
    echo    - DATABASE_URL (same as your Discord bot)
    echo    - BITUNIX_API_KEY (from bitunix.com)
    echo    - BITUNIX_API_SECRET (from bitunix.com)
    echo.
    echo 🔧 Opening .env file for editing...
    start notepad .env
) else (
    echo ❌ .env.template not found!
    echo.
    pause
    exit /b 1
)

goto :install_deps

:existing_env
echo 📝 Using existing .env file
echo.

:install_deps
echo 📦 Installing Python dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Setup complete!
echo.
echo 🧪 To test the setup:
echo    python test_integration.py
echo.
echo 🚀 To start trading:
echo    start_trading.bat
echo.
echo 📋 Remember to:
echo    1. Configure your .env file
echo    2. Start with PAPER_TRADING=true
echo    3. Test thoroughly before real trading
echo.

pause 