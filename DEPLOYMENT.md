# TravelShare — Deployment Guide

## Overview

Three services need to run simultaneously:

| Service | Tech | Default Port |
|---------|------|-------------|
| Frontend | React (served via nginx in Docker) | 3000 |
| Backend  | Node.js + Express + Socket.IO | 5000 |
| ML API   | Python + Flask | 5001 |
| Database | MongoDB | 27017 |

---

## Option 1: Local Development (Recommended for Demo)

### Prerequisites
- Node.js 18+ — https://nodejs.org
- Python 3.9+ — https://python.org
- MongoDB 6+ — https://mongodb.com/try/download/community

### Steps

```bash
# 1. Start MongoDB
mongod --dbpath /data/db

# 2. ML Service
cd ml
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python generate_dataset.py        # First time only — trains model
python api/app.py                 # Starts on port 5001

# 3. Backend
cd ../backend
cp .env.example .env
# Edit .env: set MONGODB_URI, JWT_SECRET
npm install
npm run dev                       # Starts on port 5000

# 4. Seed demo data (optional)
npm run seed

# 5. Frontend
cd ../frontend
npm install
npm start                         # Starts on port 3000
```

### Quick start scripts
```bash
# Mac/Linux
chmod +x start.sh && ./start.sh

# Windows
start.bat
```

---

## Option 2: Docker Compose (Easiest for Deployment)

### Prerequisites
- Docker Desktop — https://docker.com/products/docker-desktop

### Steps

```bash
# Clone and enter project
cd travel-share

# Create .env for backend
echo "JWT_SECRET=change_this_to_something_random_and_long" > .env

# Build and start all services
docker compose up --build

# Access the app
# Frontend → http://localhost:3000
# Backend  → http://localhost:5000
# ML API   → http://localhost:5001

# Stop services
docker compose down

# Reset (delete data volumes too)
docker compose down -v
```

### Seed demo data in Docker
```bash
docker exec ts_backend node seed.js
```

---

## Option 3: MongoDB Atlas (Cloud Database)

Replace local MongoDB with Atlas:

1. Create account at https://cloud.mongodb.com
2. Create a free M0 cluster
3. Get your connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/travelshare
   ```
4. Set in `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/travelshare
   ```

---

## Environment Variables Reference

### backend/.env
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/travelshare
JWT_SECRET=a_very_long_random_secret_string_at_least_32_chars
ML_API_URL=http://localhost:5001
NODE_ENV=development
```

### frontend/.env (optional)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ML_URL=http://localhost:5001
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

## Running Tests

### Backend tests (matching algorithms)
```bash
cd backend
npm test
# Expected: 26/26 tests passed
```

### ML tests (dataset + model)
```bash
cd ml
python tests/test_ml.py
# Expected: 26/26 tests passed
```

### Verify entire project
```bash
python verify.py
# Expected: 95%+ pass rate
```

---

## API Testing with Postman

1. Open Postman
2. Import `TravelShare_Postman_Collection.json`
3. Set collection variable `token` after registering/logging in
4. Run requests in order: Register → Login → Create Trip → Browse → Match

---

## ML Jupyter Notebook

For full EDA and model visualization:

```bash
cd ml
pip install jupyter matplotlib seaborn
jupyter notebook notebooks/TravelShare_ML_Analysis.ipynb
```

Generates plots:
- `feature_distributions.png`
- `fare_by_city.png`
- `correlation_heatmap.png`
- `model_comparison.png`
- `predicted_vs_actual.png`
- `feature_importance.png`
- `fare_by_hour.png`

---

## Standalone Demo (No Server)

Open `demo/TravelShare_Demo.html` directly in any browser.

Features a fully functional UI with:
- Browse, filter, and match trips
- ML fare calculator (rule-based, no server needed)
- In-app chat simulation with auto-replies
- Dashboard, Admin panel, Profile
- All 3 trip types (Live, Need Partner, Scheduled)

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| MongoDB not connecting | Ensure `mongod` is running or Atlas URI is correct |
| ML API error on predict | Run `python generate_dataset.py` first to train model |
| Port already in use | Kill the process using that port or change PORT in .env |
| CORS errors | Ensure backend is running and REACT_APP_API_URL matches |
| JWT errors | Make sure JWT_SECRET is set in .env and consistent |
| Socket.IO not connecting | Check REACT_APP_SOCKET_URL matches backend URL |
| `npm install` fails | Delete `node_modules/` and try again |

---

## Demo Credentials (after running `npm run seed`)

| Email | Password | City |
|-------|----------|------|
| soumyadip@demo.com | demo123 | Kolkata |
| rohit@demo.com | demo123 | Kolkata |
| ananya@demo.com | demo123 | Kolkata |
| priya@demo.com | demo123 | Mumbai |
| saptarshi@demo.com | demo123 | Delhi |
| jitendrio@demo.com | demo123 | Bengaluru |

Admin panel accessible via: `soumyadip@demo.com` → `/admin`

---

## Production Checklist

- [ ] Change `JWT_SECRET` to a long random string (32+ chars)
- [ ] Set `NODE_ENV=production` in backend .env
- [ ] Use MongoDB Atlas or managed MongoDB
- [ ] Set up HTTPS (use nginx reverse proxy or Caddy)
- [ ] Configure CORS to allow only your frontend domain
- [ ] Enable MongoDB authentication
- [ ] Set up log rotation for backend logs
- [ ] Configure ML API gunicorn workers: `gunicorn -w 2 api.app:app`
