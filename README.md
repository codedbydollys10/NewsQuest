
<p align="center">
  <img src="./logo.png" alt="NewsQuest Logo" width="200"/>
</p>
# 🚀 NewsQuest — Play the News. Predict the Future.

# 🧠 Overview

NewsQuest is a full-stack, AI-powered, gamified news platform that transforms passive news consumption into an interactive learning experience.

Instead of endlessly scrolling headlines, users can:

🎮 Play through news like a game
🧪 Solve quizzes generated from real articles
🔮 Predict future outcomes of world events
⚔️ Battle other users in real-time quiz challenges
📈 Earn XP, maintain streaks, and climb leaderboards

Built with modern web technologies and AI-powered content generation, NewsQuest combines education, engagement, prediction intelligence, and competitive gameplay into one immersive platform.

---

# 🌍 Problem Statement

Traditional news platforms are often:

❌ Passive and boring
❌ Difficult to retain and understand
❌ Overwhelming with endless information
❌ Lacking interaction and personalization
❌ Not designed for younger digital audiences

This results in low engagement, poor knowledge retention, and reduced critical thinking around current events.

---

# 💡 Solution

NewsQuest solves this by combining:

📰 Interactive news consumption
🧪 AI-generated quizzes
🔮 Real-world prediction systems
⚔️ Competitive battle modes
🏆 XP, streaks, and gamification
🤖 AI-powered content generation
📡 Real-time backend systems

The platform transforms news into a daily learning game that rewards curiosity, consistency, and critical thinking.

---

# 🏗️ Platform Architecture

## 🔷 High-Level Flow

News APIs → Backend Processing → AI Content Generation → Quiz & Prediction Engine → Supabase Database → React Frontend → User Gameplay → XP / Leaderboards / Streak Tracking

---

# 🤖 AI-Powered Intelligence System

NewsQuest uses AI to intelligently enhance news content and gameplay.

## 🧠 AI Quiz Generation

Role: Automatically generate MCQs from live news articles.

Powered By:

* Qwen API
* NewIO API

Features:

* Context-aware questions
* Instant explanations
* Difficulty balancing
* Fast response generation

Output:

* Multiple-choice questions
* Correct answers
* Explanations
* XP rewards

---

## 🔮 AI Prediction Engine (USP 🚀)

Role: Turn real-world events into prediction challenges.

Examples:

* “Will inflation rise next month?”
* “Will this bill pass parliament?”
* “Will Team X win the finals?”

Features:

* Confidence-based answering
* Prediction history tracking
* Accuracy analytics
* Long-term performance scoring

Output:

* User prediction score
* Accuracy percentage
* Prediction leaderboard ranking

---

# 📰 Smart News Feed

## Features

✅ Bite-sized news format
✅ Fast and clean reading experience
✅ Category-based filtering
✅ Mobile-first UI
✅ Interactive article experience

Categories include:

* Politics
* Economy
* Technology
* Sports
* Science
* Global Affairs

---

# 🧪 Quiz System

Every article includes interactive quizzes.

## Features

🎯 2–3 AI-generated MCQs per article
⚡ Instant feedback
📘 Answer explanations
⭐ XP rewards for correct answers
📊 Performance tracking

---

# ⚔️ Battle Mode

## Real-Time Competitive Gameplay

Users can compete against others in live quiz battles.

### Features

⚡ Fast-paced question answering
🏆 Bonus XP rewards
📈 Rank progression
🎮 Competitive learning environment

Battle scoring depends on:

* Accuracy
* Speed
* Consistency

---

# ⭐ XP & Gamification System

## Users earn XP by:

📰 Reading articles
🧪 Solving quizzes
🔮 Making predictions
⚔️ Winning battles
🔥 Maintaining streaks

## Gamification Features

🏆 Global leaderboards
📅 Daily quests
🔥 Daily streak tracking
🎖️ Level progression system

---

# 🔥 Streak System

Role: Encourage consistent learning habits.

Features:

* Daily login streaks
* Reading streaks
* Quiz streaks
* XP multipliers for consistency

---

# 🏆 Leaderboard System

Global rankings based on:

⭐ XP earned
🧪 Quiz performance
🔮 Prediction accuracy
⚔️ Battle victories

Features:

* Weekly resets
* Competitive ranking
* User progression tracking

---

# 📅 Daily Quest System

Users receive dynamic daily objectives such as:

✅ Read 5 articles
✅ Complete 3 quizzes
✅ Make 2 predictions
✅ Win 1 battle

Rewards:
⭐ Bonus XP
🏆 Progress boosts
🔥 Streak protection

---

# ⚙️ Backend & Database

## 🗄️ Supabase Integration

Supabase powers:

✅ Authentication
✅ Database storage
✅ Real-time systems
✅ User progression tracking

Stores:

* User profiles
* XP & levels
* Quiz history
* Predictions
* Streak data
* Leaderboards

---

# 🖥️ Frontend

## Tech Stack

* React.js
* TypeScript
* Tailwind CSS
* Vite

## Features

✨ Modern gaming-inspired UI
🌙 Dark theme with neon accents
📱 Mobile-first responsive design
⚡ Smooth transitions & animations

---

# ⚡ Backend

## Features

✅ News aggregation
✅ AI quiz generation
✅ Prediction processing
✅ Real-time gameplay systems
✅ XP & progression handling
✅ Supabase integration

---

# 🧠 Core Gameplay Loop

Read news 📰
Take quiz 🧪
Make prediction 🔮
Battle players ⚔️
Earn XP ⭐
Maintain streak 🔥
Climb leaderboard 🏆
Repeat 🔁

---

# 🚀 Future Scope

## Planned Features

🤖 AI-generated summaries
🎤 Voice-based news (TTS)
🧍 Avatar progression system
⚔️ Multiplayer tournaments
🧠 Personalized recommendations
📊 Advanced analytics dashboard
📱 Mobile app version

---

# 🔐 Security & Best Practices

✅ Environment variables protected using `.env`
✅ Supabase authentication system
✅ API keys hidden via `.gitignore`
✅ Modular scalable architecture
✅ Type-safe frontend using TypeScript

---

# 🧪 How to Run Locally

## Prerequisites

* Node.js 18+
* npm
* Internet connection for news APIs

---

## 1️⃣ Backend Setup

```bash
cd backend
npm install
```

Create:

```bash
backend/.env.local
```

Add:

```env
NEWSDATA_API_KEY=your_api_key
```

Run backend:

```bash
npm run start
```

Default backend URL:

```bash
http://127.0.0.1:3001
```

---

## 2️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL:

```bash
http://127.0.0.1:4000
```

---

# ⚙️ Useful Scripts

## Frontend

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Backend

```bash
npm run start
npm run build
npm run typecheck
```

---

# 📁 Project Structure

```bash
NewsQuest/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   └── assets/
│   └── package.json
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── .env.local
│   └── package.json
│
├── public/
├── README.md
└── .gitignore
```

---

# 🏆 What Makes NewsQuest Unique?

👉 Combines news + gaming + AI + prediction systems
👉 Makes current affairs interactive and addictive
👉 Encourages critical thinking & retention
👉 Turns learning into competition
👉 Creates daily knowledge-building habits

---

# 🌍 SDG Alignment

| SDG    | Goal                                  | Implementation                             |
| ------ | ------------------------------------- | ------------------------------------------ |
| SDG 4  | Quality Education                     | Interactive learning through gamified news |
| SDG 9  | Industry, Innovation & Infrastructure | AI-powered news intelligence platform      |
| SDG 16 | Peace, Justice & Strong Institutions  | Encourages informed civic awareness        |

---

# 🚀 Key Innovations

🧪 AI-generated quizzes from live news
🔮 Real-world prediction gameplay
⚔️ Real-time battle system
⭐ Full XP & progression mechanics
🔥 Habit-building streak system
🏆 Competitive leaderboard ecosystem
🧠 AI-enhanced educational experience

---


# ⭐ If You Like This Project

Give it a ⭐ on GitHub and support interactive learning through AI-powered news gaming!

---

# 💬 Final Thought

NewsQuest is not just a news app — it’s a gamified intelligence platform.

> “Don’t just read the news. Play it. Predict it. Master it.” 🚀
