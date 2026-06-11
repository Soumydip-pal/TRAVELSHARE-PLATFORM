#!/bin/bash
# TravelShare Quick Start Script
# Run: chmod +x start.sh && ./start.sh

echo "🚗 TravelShare - Starting all services..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.9+"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found locally. Make sure MONGODB_URI is set correctly in backend/.env"
fi

# Check .env
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating backend/.env from example...${NC}"
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env with your MongoDB URI and JWT secret."
fi

# ML Service
echo -e "${BLUE}[1/3] Setting up ML service...${NC}"
cd ml

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

pip install -r requirements.txt -q

if [ ! -f "models/fare_model.pkl" ]; then
    echo -e "${YELLOW}Training ML model (first time, ~1-2 min)...${NC}"
    python generate_dataset.py
fi

python api/app.py &
ML_PID=$!
echo -e "${GREEN}✅ ML API running on http://localhost:5001 (PID: $ML_PID)${NC}"

cd ..

# Backend
echo -e "${BLUE}[2/3] Starting backend...${NC}"
cd backend

if [ ! -d "node_modules" ]; then
    npm install -q
fi

npm run dev &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend running on http://localhost:5000 (PID: $BACKEND_PID)${NC}"

cd ..

# Frontend
echo -e "${BLUE}[3/3] Starting frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    npm install -q
fi

npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend starting on http://localhost:3000 (PID: $FRONTEND_PID)${NC}"

cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🚀 All services started!${NC}"
echo ""
echo "  Frontend  → http://localhost:3000"
echo "  Backend   → http://localhost:5000"
echo "  ML API    → http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop all services."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait and clean up
trap "echo 'Stopping services...'; kill $ML_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
