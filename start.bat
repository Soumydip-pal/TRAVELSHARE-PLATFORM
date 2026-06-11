@echo off
REM TravelShare Quick Start — Windows
REM Run: start.bat

title TravelShare - Starting Services

echo.
echo  ========================================
echo   TravelShare - Travel Sharing App
echo  ========================================
echo.

REM Check Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

REM Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install from https://python.org
    pause
    exit /b 1
)

REM Copy .env if missing
if not exist "backend\.env" (
    echo Creating backend\.env from example...
    copy "backend\.env.example" "backend\.env"
    echo [!] Please edit backend\.env with your MongoDB URI
)

echo [1/3] Starting ML Service (port 5001)...
cd ml
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
if not exist "models\fare_model.pkl" (
    echo Training ML model for first time ^(~1-2 min^)...
    python generate_dataset.py
)
start "ML API" cmd /k "call venv\Scripts\activate.bat && python api\app.py"
cd ..

echo [2/3] Starting Backend (port 5000)...
cd backend
if not exist "node_modules" (
    npm install
)
start "Backend" cmd /k "npm run dev"
cd ..

echo [3/3] Starting Frontend (port 3000)...
cd frontend
if not exist "node_modules" (
    npm install
)
start "Frontend" cmd /k "npm start"
cd ..

echo.
echo  ========================================
echo   All services starting!
echo.
echo   Frontend  http://localhost:3000
echo   Backend   http://localhost:5000
echo   ML API    http://localhost:5001
echo  ========================================
echo.
echo  Close the terminal windows to stop services.
pause
