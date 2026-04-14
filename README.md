
# 🚀 NewsQuest — Play the News. Predict the Future.

   ## 🎥 Demo Video

   Watch Project Video:-(https://drive.google.com/file/d/16L4UAObIVtJ-008D-kh9CL0mhlab5j6K/view)

## 🧠 Overview 

**NewsQuest** is a next-generation, gamified news platform that transforms passive news reading into an **interactive, competitive, and intelligent experience**.

Instead of just scrolling headlines, users:

* 🎮 Play through news like a game
* 🧪 Test knowledge with quizzes
* 🔮 Predict real-world outcomes
* 📈 Track progress with XP & streaks
* 🏆 Compete on leaderboards

---

## 🎯 Why NewsQuest?

Traditional news platforms are:

* ❌ Passive
* ❌ Hard to retain
* ❌ Not engaging

**NewsQuest makes news:**

* ✅ Interactive
* ✅ Fun
* ✅ Educational
* ✅ Addictive (in a good way)

---

## ✨ Core Features

### 📰 1. Smart News Feed

* Bite-sized, structured news
* Clean UI for fast reading
* Categories like Polity, Economy, Tech

---

### 🧪 2. Quiz System

* 2–3 MCQs per article
* Instant feedback + explanations
* XP rewards for correct answers

---

### 🔮 3. Prediction Engine (USP 🚀)

* Predict future outcomes of real-world events
* Confidence-based answering
* Accuracy tracking over time

---

### ⚔️ 4. Battle Mode

* Compete with other users in real-time
* Answer questions faster and more accurately
* Earn bonus XP and rank higher

---

### ⭐ 5. XP & Level System

* Earn XP by:

  * Reading news
  * Solving quizzes
  * Making predictions
* Level up as you progress

---

### 🔥 6. Streak System

* Daily activity tracking
* Rewards for consistency
* Encourages habit building

---

### 🏆 7. Leaderboard

* Global ranking system
* Based on XP and performance
* Weekly competition resets

---

### 📅 8. Daily Quests

* Complete tasks like:

  * Read articles
  * Take quizzes
  * Make predictions
* Earn bonus rewards

---

## 🧠 AI-Powered Intelligence

NewsQuest uses advanced AI to generate:

* 🧪 Quiz questions
* 🔮 Prediction scenarios

### APIs Used:

* **Qwen API** → For intelligent content generation
* **NewIO API** → For dynamic processing and responses

---

## 🗄️ Backend & Database

### 🔹 Supabase

* Authentication
* Database storage
* Real-time updates

Stores:

* User progress
* XP & levels
* Quiz results
* Predictions
* Leaderboard data

---

## 🎮 Core Game Loop

1. Read news 📰
2. Take quiz 🧪
3. Make prediction 🔮
4. Earn XP ⭐
5. Maintain streak 🔥
6. Climb leaderboard 🏆
7. Repeat 🔁

---

## 🎨 UI/UX Highlights

* Dark theme with neon accents
* Smooth animations
* Game-like interface
* Mobile-first design

---

## 🚀 Future Scope

* AI-powered summaries
* Voice-based news (TTS)
* Avatar progression system
* Multiplayer challenges
* Personalized recommendations

---

## 📂 Project Structure (Example)

```bash
NewsQuest/
│── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── utils/
│── public/
│── README.md
```

---

## 🏆 What Makes It Unique?

👉 Combines **news + gaming + AI + prediction**
👉 Encourages **critical thinking**
👉 Builds **daily learning habits**

---

## 💬 Final Thought

**NewsQuest is not just a news app — it's a learning game.**

> “Don’t just read the news. Play it. Predict it. Master it.” 🚀


## What You Need

- Node.js 18 or newer
- npm
- Internet access for live news APIs

## Project Structure

- `frontend/` - React app, UI, and client-side state
- `backend/` - News API, enrichment API, and content generation endpoints

## Setup

1. Install dependencies in both folders:
   - `cd backend && npm install`
   - `cd frontend && npm install`
2. Make sure the backend environment file exists:
   - `backend/.env.local` should contain `NEWSDATA_API_KEY`
   - You can copy values from `backend/.env.example` and fill in your key
3. Start the backend first:
   - `cd backend && npm run start`
   - Default backend URL: `http://127.0.0.1:3001`
4. Start the frontend in a second terminal:
   - `cd frontend && npm run dev`
   - Default frontend URL: `http://127.0.0.1:4000`

## Environment Notes

- The frontend uses `/api` in development and Vite proxies it to the backend automatically.
- If you want to point the frontend to a hosted backend, set `VITE_API_URL` in `frontend/.env`.
- If you see `ECONNREFUSED 127.0.0.1:3001`, the backend is not running yet.

## Useful Scripts

Frontend:
- `cd frontend && npm run dev`
- `cd frontend && npm run build`
- `cd frontend && npm run lint`
- `cd frontend && npm run test`

Backend:
- `cd backend && npm run start`
- `cd backend && npm run build`
- `cd backend && npm run typecheck`
