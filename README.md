# Examly — Online Examination System with SQLite Database

A full-stack, responsive online examination portal with a built-in **SQLite relational database**, secure **BCrypt password hashing**, **session management**, and **server-side exam evaluation**.

---

## 🚀 Quick Start

### 1. Install Dependencies
Open your terminal in this directory:
```bash
npm install
```
*(Dependencies: `express`, `bcryptjs`, `cors`)*

### 2. Start the Server
```bash
npm start
```
Then open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

### 3. Demo Credentials
You can register a new account anytime, or use the pre-seeded account:
- **Email:** `student@examly.com`
- **Password:** `password123`

---

## 🗄️ Database Architecture

The application uses an embedded **SQLite 3 database (`exam_portal.db`)** that requires zero external setup or background services.

### Relational Schema:
1. **`users`**
   - `id`, `name`, `email` (UNIQUE), `password_hash` (BCrypt), `created_at`
2. **`sessions`**
   - `token` (PRIMARY KEY), `user_id` (FK -> users), `created_at`, `expires_at`
3. **`exams`**
   - `id`, `slug` (UNIQUE), `title`, `description`, `category`, `difficulty`, `time_limit`, `points_per_question`, `created_at`
4. **`questions`**
   - `id`, `exam_id` (FK -> exams), `question_text`, `explanation`, `order_num`
5. **`question_options`**
   - `id`, `question_id` (FK -> questions), `option_text`, `option_index`, `is_correct`
6. **`attempts`**
   - `id`, `user_id` (FK -> users), `user_email`, `exam_id`, `exam_slug`, `exam_title`, `points`, `total_points`, `percent`, `correct_count`, `incorrect_count`, `auto_submitted`, `created_at`
7. **`attempt_answers`**
   - `id`, `attempt_id` (FK -> attempts), `question_id` (FK -> questions), `selected_option`, `is_correct`
8. **`exam_sessions`**
   - `id` (UUID), `user_id` (FK -> users, nullable for guests), `exam_id` (FK -> exams), `question_ids` (JSON list of the questions picked for this attempt), `started_at`, `expires_at`, `submitted`

---

## 📊 Viewing Database Records in Terminal

To inspect registered users, active sessions, exams, and exam attempts directly in your terminal, run:

```bash
npm run db:view
```

Output preview:
```text
======================================================
       📊 EXAMLY SQLITE DATABASE VIEWER 📊            
       File: exam_portal.db
======================================================
👥 REGISTERED USERS
📚 AVAILABLE EXAMS
📝 EXAM ATTEMPTS HISTORY
📈 SUMMARY METRICS
```

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Database connection status and record counts |
| `POST` | `/api/auth/register` | Register new user with BCrypt password hashing |
| `POST` | `/api/auth/login` | Authenticate user and issue session token |
| `GET` | `/api/auth/me` | Verify and return active user session |
| `POST` | `/api/auth/logout` | Invalidate active session in database |
| `GET` | `/api/exams` | List all exams from database |
| `GET` | `/api/exams/:slug` | Get exam details and the full question bank (no answers) |
| `POST` | `/api/exams/:slug/start` | Start an attempt: returns a `sessionId` and **20 random questions** (no answers) |
| `POST` | `/api/exams/:slug/submit` | Grade an attempt. Body: `{ sessionId, answers: { "<questionId>": optionIndex }, auto }` |
| `GET` | `/api/attempts` | Fetch user attempt history from database |
| `DELETE` | `/api/attempts` | Clear user attempt history from database |
| `GET` | `/api/stats` | Dashboard statistics (exams, attempts, best score) |

---

## 🛡️ Key Features

- **Real Database Persistence:** All users, sessions, questions, and attempt records are saved in SQLite (`exam_portal.db`).
- **Live Database Badge:** Header displays `🟢 SQLite Connected` in real-time.
- **Secure Authentication:** Passwords hashed with `bcryptjs` (salt rounds: 10).
- **Random 20 Questions Per Attempt:** Each exam has a bank of 40 questions (`questions-bank.json`, synced into the database on every start). Every attempt gets 20 randomly chosen ones, picked and remembered by the server (`exam_sessions`). Retaking an exam gives a different mix. Add more questions to `questions-bank.json` and restart to grow the bank; existing databases are upgraded automatically.
- **Server-Checked Timer:** Each attempt has a deadline stored on the server (20 minutes). Submissions more than 60 seconds late are rejected, and an attempt can only be submitted once.
- **Anti-Cheat Grading:** Correct answers and explanations are protected on the server and only revealed upon submission.
- **Detailed Review:** Score ring, correct/incorrect count, and explanations for each question.
- **Offline Resilience:** If the server is stopped, the frontend smoothly falls back to local mode with a `🟡 Offline Mode` badge.
- **Dark Mode Support:** Clean light and dark theme toggle.
