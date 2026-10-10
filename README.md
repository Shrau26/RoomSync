# 🏠 RoomSync

> **Find Rooms. Find Roommates. Find Comfort.**

RoomSync is a full-stack room recommendation and roommate matching platform for students — built with React.js, Node.js, Firebase, and a Python AI matching engine.

---

## 📁 Project Structure

```
roomsync/
├── src/                    # React frontend (Vite)
│   ├── components/
│   │   ├── common/         # AuthLayout, shared UI
│   │   └── layout/         # Sidebar, Topbar, DashboardLayout
│   ├── pages/              # All page components
│   ├── services/           # Firebase CRUD helpers
│   ├── firebase/           # Firebase config
│   └── context/            # React Context (Auth state)
├── backend/                # Node.js + Express REST API
│   ├── server.js
│   └── package.json
├── flask-api/              # Python AI Matching API
│   ├── app.py
│   └── requirements.txt
└── README.md
```

---

## 🚀 Quick Start

### 1. Firebase Setup (Required)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** → Email/Password provider
4. Enable **Firestore Database** (start in test mode)
5. Enable **Storage**
6. Go to **Project Settings → Your Apps** → Add Web App
7. Copy your config into `src/firebase/config.js`:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 2. Frontend (React + Vite)

```bash
# In the root roomsync/ directory
npm install
npm run dev
# Opens at http://localhost:3000
```

### 3. Backend (Node.js + Express)

```bash
cd backend
npm install

# Add Firebase service account
# Firebase Console → Project Settings → Service Accounts → Generate new private key
# Save as backend/serviceAccountKey.json

npm run dev
# Runs at http://localhost:4000
```

### 4. Python AI API (Flask)

```bash
cd flask-api
pip install -r requirements.txt
python app.py
# Runs at http://localhost:5001
```

---

## ✨ Features

### Phase 1 (Built)
| Feature | Description |
|---------|-------------|
| 🔐 Authentication | Login, Signup, Forgot Password via Firebase |
| 📊 Dashboard | Stats overview, quick actions, greeting |
| 👤 Profile | Full profile editor synced to Firestore |
| 🏠 Browse Rooms | Grid view with search and price filter |
| ➕ Add Listing | Room listing form with image upload |
| 🤖 AI Matching | Compatibility scoring (calls Flask API) |
| 💬 Chat | Real-time chat UI (Firebase-ready) |
| 📅 Visit Scheduler | Date-time booking system |
| ⭐ Reviews | Star rating and review system |
| 💰 Expense Estimator | Monthly cost breakdown calculator |

### Phase 2 (Placeholder structure ready)
- Real-time Firestore chat
- Map location picker
- Push notifications
- Referral system

---

## 🎨 UI Theme

- **Primary gradient**: `from-blue-600 to-purple-600`
- **Background**: Dark navy `#0f0c29 → #24243e`
- **Glass cards**: `bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20`
- **Font**: Sora (display) + DM Sans (body)

---

## 🧠 AI Matching Algorithm

Located in `flask-api/app.py`. Scores are computed as a weighted average:

| Factor | Weight | Logic |
|--------|--------|-------|
| Budget overlap | 30% | Range intersection |
| Sleep schedule | 25% | Exact category match |
| Study habit | 20% | Exact category match |
| Cleanliness | 15% | Numeric proximity (1–5) |
| Year of study | 10% | Adjacent year bonus |

---

## 🔥 Firestore Collections

### `users`
```
uid, name, email, college, year, budget: {min, max},
sleep_schedule, study_type, cleanliness, profile_image_url, created_at
```

### `rooms`
```
room_id, owner_id, title, price, location, room_type,
facilities: [], images: [], description, created_at
```

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |
| AI API | Python + Flask |

---

## 📝 Environment Variables

Create `backend/.env`:
```
PORT=4000
```

---

## 📄 License

MIT — Built for students, by students. 🎓
