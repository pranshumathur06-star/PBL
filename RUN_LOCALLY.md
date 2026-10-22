# EASE: run locally

Prereqs: Node 20+, Yarn (`npm i -g yarn`), Python 3.11+, MongoDB (local install, Docker, or a free Atlas URI).

## 1. MongoDB
Docker:  docker run -d --name ease-mongo -p 27017:27017 mongo:7
(or install MongoDB Community, or put an Atlas URI in backend/.env as MONGO_URL)

## 2. Backend (terminal 1)
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
python seed.py
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

## 3. Frontend (terminal 2)
cd frontend
yarn install
yarn dev
# open http://localhost:3000

## Demo logins (after seed.py)
admin@ease.demo / EaseDemo112   (also dispatcher@ease.demo, analyst@ease.demo)
Citizen: register at /login (demo OTP shows on screen). Guest: /app

## Troubleshooting
- Blank data / network errors: backend not running on 8001, or MongoDB not up.
- bcrypt/passlib error: keep bcrypt==4.0.1 as pinned.
- Port busy: change `port` in frontend/vite.config.ts.
