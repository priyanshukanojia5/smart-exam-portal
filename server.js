const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const path = require('node:path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files (from public or root)
const publicFolder = path.join(__dirname, 'public');
if (require('node:fs').existsSync(publicFolder)) {
  app.use(express.static(publicFolder));
}
app.use(express.static(__dirname));

// Optional Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = db.findSessionUser(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

app.use(authMiddleware);

// --- API ROUTES ---

// 1. Health and database status
app.get('/api/status', (req, res) => {
  try {
    const dbStatus = db.getDatabaseStatus();
    res.json({
      status: 'online',
      message: 'Examly backend and database are running smoothly.',
      database: dbStatus
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 2. Authentication: Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid name (at least 2 characters).' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const newUser = db.createUser(name.trim(), email.trim(), password);
    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(newUser.id, token);

    res.status(201).json({
      message: 'Account created successfully.',
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// 3. Authentication: Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = db.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(user.id, token);

    res.json({
      message: 'Signed in successfully.',
      user: { id: user.id, name: user.name, email: user.email },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// 4. Current user session check
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ user: null });
  }
  res.json({ user: req.user });
});

// 5. Authentication: Logout
app.post('/api/auth/logout', (req, res) => {
  if (req.token) {
    db.deleteSession(req.token);
  }
  res.json({ message: 'Signed out successfully.' });
});

// 6. Get all available exams
app.get('/api/exams', (req, res) => {
  try {
    const exams = db.getAllExams();
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load exams: ' + err.message });
  }
});

// 7. Get single exam with questions
app.get('/api/exams/:slug', (req, res) => {
  try {
    const exam = db.getExamBySlug(req.params.slug, false);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load exam: ' + err.message });
  }
});

// 8. Submit and grade exam
app.post('/api/exams/:slug/submit', (req, res) => {
  try {
    const { answers, auto } = req.body;
    const userId = req.user ? req.user.id : null;
    const userEmail = req.user ? req.user.email : (req.body.email || 'guest');

    const result = db.gradeAndSaveAttempt({
      examSlug: req.params.slug,
      answers: Array.isArray(answers) ? answers : [],
      userId,
      userEmail,
      autoSubmitted: !!auto
    });

    res.json(result);
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to submit exam: ' + err.message });
  }
});

// 9. Get user attempts
app.get('/api/attempts', (req, res) => {
  try {
    const userEmail = req.user ? req.user.email : (req.query.email || 'guest');
    const attempts = db.getAttempts(userEmail);
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load attempts: ' + err.message });
  }
});

// 10. Clear user attempts
app.delete('/api/attempts', (req, res) => {
  try {
    const userEmail = req.user ? req.user.email : (req.query.email || 'guest');
    const deletedCount = db.clearAttempts(userEmail);
    res.json({ message: 'History cleared successfully.', deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear attempts: ' + err.message });
  }
});

// 11. Dashboard statistics
app.get('/api/stats', (req, res) => {
  try {
    const userEmail = req.user ? req.user.email : (req.query.email || null);
    const stats = db.getStats(userEmail);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load statistics: ' + err.message });
  }
});

// Fallback to index.html for root navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server locally (Vercel uses exported handler)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Examly Server is live at: http://localhost:${PORT}`);
    console.log(`📦 Database: SQLite (exam_portal.db)`);
    console.log(`🔑 Demo Account: student@examly.com / password123`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
