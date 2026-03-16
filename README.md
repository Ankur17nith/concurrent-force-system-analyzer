# Concurrent Force System Analyzer

## Project Objective
This project is an academic mechanical engineering tool to analyze a 2D concurrent force system. Users enter multiple forces (magnitude and angle), and the tool calculates the system resultant and equilibrium force information.

## Concurrent Force System Theory
In a concurrent force system, all forces pass through one common point.

For static equilibrium:
- Sigma Fx = 0
- Sigma Fy = 0

If these are not zero, the system has a non-zero resultant force.

## Formulas Used
For each force with magnitude F and angle theta:

- Fx = F cos(theta)
- Fy = F sin(theta)

Summation:

- Sigma Fx = Fx1 + Fx2 + ...
- Sigma Fy = Fy1 + Fy2 + ...

Resultant magnitude:

- R = sqrt((Sigma Fx)^2 + (Sigma Fy)^2)

Resultant direction:

- theta = atan2(Sigma Fy, Sigma Fx)

Equilibrium force (displayed in frontend):

- Feq_x = -Sigma Fx
- Feq_y = -Sigma Fy
- Feq angle = theta + 180 degrees

## Architecture (Vercel + Render)
- Frontend: static files hosted on Vercel
- Backend: Flask API hosted on Render
- Version control: GitHub

Request flow:
1. Frontend sends POST request to /calculate on Render backend.
2. Backend computes sums/resultant and returns JSON.
3. Frontend displays values and draws vectors on canvas.

## Final Structure

- backend/app.py
- backend/requirements.txt
- backend/Procfile
- frontend/index.html
- frontend/style.css
- frontend/script.js
- README.md

## API Contract
Endpoint:
- POST /calculate

Request JSON:

```json
{
  "forces": [
    {"magnitude": 50, "angle": 30},
    {"magnitude": 70, "angle": 120}
  ]
}
```

Response JSON:

```json
{
  "sumFx": -10.6218,
  "sumFy": 85.6218,
  "resultant": 86.277,
  "angle": 97.0685
}
```

## Run Locally
### 1) Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Backend runs on:
- http://127.0.0.1:5000

### 2) Frontend
Open frontend/index.html directly in browser,
or serve it with any static server.

Before production deployment, update the API URL in frontend/script.js:
- API_BASE_URL = "https://YOUR_RENDER_BACKEND_URL"

## Deploy to Render (Backend)
1. Push repository to GitHub.
2. In Render, create a new Web Service from the GitHub repo.
3. Set Root Directory to backend.
4. Build command:
   - pip install -r requirements.txt
5. Start command:
   - gunicorn app:app
6. Deploy and copy the Render service URL.

## Deploy to Vercel (Frontend)
1. In Vercel, import the same GitHub repository.
2. Set Root Directory to frontend.
3. Framework preset: Other.
4. Deploy.
5. Update frontend/script.js API_BASE_URL with your Render URL and redeploy frontend.

## GitHub Workflow
```bash
git add .
git commit -m "Restructure project into frontend and backend for Vercel and Render"
git push
```
