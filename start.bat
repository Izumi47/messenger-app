@echo off
REM Private Messenger - Quick Start Script for Windows

echo 🔒 Private Messenger - Starting...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo 📥 Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Check .env file
if not exist ".env" (
    echo ⚠️  .env file not found!
    echo 📝 Creating default .env...
    (
        echo PORT=3000
        echo JWT_SECRET=your-super-secret-key-change-this-in-production
        echo NODE_ENV=production
    ) > .env
    echo ⚠️  Please edit .env and change JWT_SECRET!
    echo.
)

echo.
echo 🚀 Starting server...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 📍 Local access: http://localhost:3000
echo 🌐 Remote access: https://thrush-close-civet.ngrok-free.app
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Start ngrok in a new terminal window
echo 🔗 Opening ngrok tunnel in new window...
start "Ngrok Tunnel" cmd /k "ngrok http --domain=thrush-close-civet.ngrok-free.app 3000"
timeout /t 2 /nobreak >nul

echo ✅ Server and ngrok tunnel started!
echo.

call npm start
pause
