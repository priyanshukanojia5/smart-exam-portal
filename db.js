const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const isVercel = !!process.env.VERCEL;
let DB_PATH = path.join(__dirname, 'exam_portal.db');

if (isVercel) {
  const tmpDb = '/tmp/exam_portal.db';
  if (!fs.existsSync(tmpDb)) {
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, tmpDb);
      }
    } catch (e) {
      console.warn('Could not copy seed db to /tmp, will initialize fresh:', e.message);
    }
  }
  DB_PATH = tmpDb;
}

const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for better concurrency and performance
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initDatabase() {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Auth sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. Exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      time_limit INTEGER NOT NULL DEFAULT 480,
      points_per_question INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 4. Questions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      explanation TEXT NOT NULL,
      order_num INTEGER NOT NULL,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
    );
  `);

  // 5. Question options table
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );
  `);

  // 6. Exam attempts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT NOT NULL,
      exam_id INTEGER NOT NULL,
      exam_slug TEXT NOT NULL,
      exam_title TEXT NOT NULL,
      points INTEGER NOT NULL,
      total_points INTEGER NOT NULL,
      percent INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      incorrect_count INTEGER NOT NULL,
      auto_submitted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
    );
  `);

  // 7. Individual question answers for each attempt
  db.exec(`
    CREATE TABLE IF NOT EXISTS attempt_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_option INTEGER,
      is_correct INTEGER NOT NULL,
      FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );
  `);

  // Check if exams need to be seeded
  const examCount = db.prepare('SELECT COUNT(*) as count FROM exams').get().count;
  if (examCount === 0) {
    seedDatabase();
  }
}

function seedDatabase() {
  console.log('🌱 Seeding database with initial exams and demo student account...');

  // Create default demo user
  const demoEmail = 'student@examly.com';
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
  if (!existingUser) {
    const saltRounds = 10;
    const defaultHash = bcrypt.hashSync('password123', saltRounds);
    db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run('Demo Student', demoEmail, defaultHash);
  }

  // Seed Exams and Questions
  const initialExams = [
    {
      slug: 'dsa',
      title: 'Data Structures & Algorithms',
      description: 'Stacks, queues, searching, sorting, and complexity basics.',
      category: 'COMPUTER SCIENCE',
      difficulty: 'INTERMEDIATE',
      timeLimit: 600,
      pointsPerQuestion: 2,
      questions: [
        {
          q: 'Which data structure follows the LIFO principle?',
          options: ['Queue', 'Stack', 'Binary tree', 'Graph'],
          answer: 1,
          explain: 'A stack follows Last In, First Out (LIFO).'
        },
        {
          q: 'What is the average time complexity of binary search on a sorted array?',
          options: ['O(n)', 'O(1)', 'O(log n)', 'O(n log n)'],
          answer: 2,
          explain: 'Binary search halves the search interval at every step.'
        },
        {
          q: 'Which data structure is commonly used for a first-in, first-out process?',
          options: ['Stack', 'Queue', 'Heap', 'Hash table'],
          answer: 1,
          explain: 'A queue removes elements in the same order they were inserted (FIFO).'
        },
        {
          q: 'Which sorting algorithm repeatedly selects the smallest remaining element?',
          options: ['Bubble sort', 'Merge sort', 'Selection sort', 'Quick sort'],
          answer: 2,
          explain: 'Selection sort selects the minimum item from the unsorted portion each pass.'
        },
        {
          q: 'What does Big O notation primarily describe?',
          options: ['Exact runtime in seconds', 'An upper bound on growth rate', 'The programming language', 'Memory address'],
          answer: 1,
          explain: 'Big O describes an asymptotic upper bound on an algorithm\'s growth.'
        }
      ]
    },
    {
      slug: 'java',
      title: 'Java Fundamentals',
      description: 'Test your understanding of Java syntax and core concepts.',
      category: 'PROGRAMMING',
      difficulty: 'BEGINNER',
      timeLimit: 480,
      pointsPerQuestion: 2,
      questions: [
        {
          q: 'Which keyword is used to inherit a class in Java?',
          options: ['implements', 'inherits', 'extends', 'super'],
          answer: 2,
          explain: 'A class uses extends to inherit from another class.'
        },
        {
          q: 'Which method is the usual entry point of a Java application?',
          options: ['start()', 'main()', 'run()', 'init()'],
          answer: 1,
          explain: 'The standard entry point is public static void main(String[] args).'
        },
        {
          q: 'Which of these is not a primitive Java type?',
          options: ['int', 'boolean', 'String', 'double'],
          answer: 2,
          explain: 'String is a class, not a primitive type.'
        },
        {
          q: 'Which collection does not allow duplicate elements?',
          options: ['ArrayList', 'LinkedList', 'HashSet', 'Vector'],
          answer: 2,
          explain: 'Set implementations such as HashSet store unique elements.'
        },
        {
          q: 'What does JVM stand for?',
          options: ['Java Variable Method', 'Java Virtual Machine', 'Joint Version Manager', 'Java Visual Model'],
          answer: 1,
          explain: 'The JVM executes Java bytecode.'
        }
      ]
    },
    {
      slug: 'web',
      title: 'Web Development Basics',
      description: 'HTML, CSS, JavaScript, and the foundations of the web.',
      category: 'WEB TECHNOLOGY',
      difficulty: 'BEGINNER',
      timeLimit: 480,
      pointsPerQuestion: 2,
      questions: [
        {
          q: 'What does HTML stand for?',
          options: ['HyperText Markup Language', 'High Transfer Machine Language', 'Hyperlink Text Management Logic', 'Home Tool Markup Language'],
          answer: 0,
          explain: 'HTML stands for HyperText Markup Language.'
        },
        {
          q: 'Which CSS property changes text color?',
          options: ['font-style', 'background', 'color', 'text-weight'],
          answer: 2,
          explain: 'The color property sets an element\'s foreground/text color.'
        },
        {
          q: 'Which keyword declares a block-scoped variable that can be reassigned in JavaScript?',
          options: ['const', 'let', 'static', 'define'],
          answer: 1,
          explain: 'let declares a block-scoped variable that can be reassigned.'
        },
        {
          q: 'Which HTML element creates a hyperlink?',
          options: ['<link>', '<a>', '<href>', '<url>'],
          answer: 1,
          explain: 'The anchor element <a> creates a hyperlink using href.'
        },
        {
          q: 'What is the DOM?',
          options: ['A CSS framework', 'A database query', 'A programming language', 'An object representation of a document'],
          answer: 3,
          explain: 'The DOM represents a document as a tree of objects that scripts can access.'
        }
      ]
    }
  ];

  db.exec('BEGIN TRANSACTION;');
  try {
    const insertExam = db.prepare(`
      INSERT INTO exams (slug, title, description, category, difficulty, time_limit, points_per_question)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertQuestion = db.prepare(`
      INSERT INTO questions (exam_id, question_text, explanation, order_num)
      VALUES (?, ?, ?, ?)
    `);

    const insertOption = db.prepare(`
      INSERT INTO question_options (question_id, option_text, option_index, is_correct)
      VALUES (?, ?, ?, ?)
    `);

    for (const e of initialExams) {
      const examRes = insertExam.run(
        e.slug,
        e.title,
        e.description,
        e.category,
        e.difficulty,
        e.timeLimit,
        e.pointsPerQuestion
      );
      const examId = Number(examRes.lastInsertRowid);

      for (let i = 0; i < e.questions.length; i++) {
        const q = e.questions[i];
        const qRes = insertQuestion.run(examId, q.q, q.explain, i);
        const questionId = Number(qRes.lastInsertRowid);

        for (let j = 0; j < q.options.length; j++) {
          insertOption.run(questionId, q.options[j], j, j === q.answer ? 1 : 0);
        }
      }
    }
    db.exec('COMMIT;');
    console.log('✅ Database seeded successfully!');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('❌ Error seeding database:', err);
  }
}

// User operations
function createUser(name, email, password) {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
  `);
  const res = stmt.run(name, email.toLowerCase(), passwordHash);
  return { id: Number(res.lastInsertRowid), name, email: email.toLowerCase() };
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
}

function findUserById(id) {
  return db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(id);
}

function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compareSync(plainPassword, passwordHash);
}

// Session operations
function createSession(userId, token, expiryDays = 7) {
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);
  return { token, userId, expiresAt };
}

function findSessionUser(token) {
  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.email
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    deleteSession(token);
    return null;
  }
  return { id: session.id, name: session.name, email: session.email };
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Exam operations
function getAllExams() {
  const exams = db.prepare(`
    SELECT e.*, COUNT(q.id) as question_count
    FROM exams e
    LEFT JOIN questions q ON e.id = q.exam_id
    GROUP BY e.id
    ORDER BY e.id ASC
  `).all();

  return exams.map(e => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    category: e.category,
    difficulty: e.difficulty,
    timeLimit: e.time_limit,
    pointsPerQuestion: e.points_per_question,
    questionCount: Number(e.question_count),
    totalPoints: Number(e.question_count) * e.points_per_question
  }));
}

function getExamBySlug(slug, includeAnswers = false) {
  const exam = db.prepare('SELECT * FROM exams WHERE slug = ?').get(slug);
  if (!exam) return null;

  const questions = db.prepare(`
    SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num ASC
  `).all(exam.id);

  const formattedQuestions = questions.map(q => {
    const options = db.prepare(`
      SELECT option_text, option_index, is_correct
      FROM question_options
      WHERE question_id = ?
      ORDER BY option_index ASC
    `).all(q.id);

    const qObj = {
      id: q.id,
      q: q.question_text,
      options: options.map(o => o.option_text),
      order: q.order_num
    };

    if (includeAnswers) {
      const correctOpt = options.find(o => o.is_correct === 1);
      qObj.answer = correctOpt ? correctOpt.option_index : 0;
      qObj.explain = q.explanation;
    }

    return qObj;
  });

  return {
    id: exam.id,
    slug: exam.slug,
    title: exam.title,
    description: exam.description,
    category: exam.category,
    difficulty: exam.difficulty,
    time: exam.time_limit,
    pointsPerQuestion: exam.points_per_question,
    questions: formattedQuestions
  };
}

// Submit and grade attempt
function gradeAndSaveAttempt({ examSlug, answers, userId = null, userEmail = 'guest', autoSubmitted = false }) {
  const exam = db.prepare('SELECT * FROM exams WHERE slug = ?').get(examSlug);
  if (!exam) throw new Error('Exam not found');

  const questions = db.prepare(`
    SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num ASC
  `).all(exam.id);

  let correctCount = 0;
  const reviewQuestions = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const options = db.prepare(`
      SELECT option_text, option_index, is_correct
      FROM question_options
      WHERE question_id = ?
      ORDER BY option_index ASC
    `).all(q.id);

    const correctOption = options.find(o => o.is_correct === 1);
    const correctAnswerIndex = correctOption ? correctOption.option_index : 0;
    const selectedAnswer = answers && answers[i] !== undefined ? answers[i] : null;
    const isCorrect = selectedAnswer !== null && selectedAnswer === correctAnswerIndex;

    if (isCorrect) {
      correctCount++;
    }

    reviewQuestions.push({
      questionId: q.id,
      q: q.question_text,
      options: options.map(o => o.option_text),
      selectedAnswer,
      correctAnswer: correctAnswerIndex,
      isCorrect,
      explain: q.explanation
    });
  }

  const points = correctCount * exam.points_per_question;
  const totalPoints = questions.length * exam.points_per_question;
  const percent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const incorrectCount = questions.length - correctCount;

  // Insert attempt
  const insertAttempt = db.prepare(`
    INSERT INTO attempts (
      user_id, user_email, exam_id, exam_slug, exam_title,
      points, total_points, percent, correct_count, incorrect_count, auto_submitted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const attemptRes = insertAttempt.run(
    userId,
    userEmail,
    exam.id,
    exam.slug,
    exam.title,
    points,
    totalPoints,
    percent,
    correctCount,
    incorrectCount,
    autoSubmitted ? 1 : 0
  );

  const attemptId = Number(attemptRes.lastInsertRowid);

  // Insert attempt answers
  const insertAnswer = db.prepare(`
    INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct)
    VALUES (?, ?, ?, ?)
  `);

  for (const rq of reviewQuestions) {
    insertAnswer.run(
      attemptId,
      rq.questionId,
      rq.selectedAnswer,
      rq.isCorrect ? 1 : 0
    );
  }

  return {
    attemptId,
    key: exam.slug,
    title: exam.title,
    correct: correctCount,
    incorrect: incorrectCount,
    points,
    total: totalPoints,
    percent,
    answers: answers ? answers.slice() : [],
    auto: autoSubmitted,
    date: new Date().toISOString(),
    email: userEmail,
    review: reviewQuestions
  };
}

// Fetch attempts for a user
function getAttempts(userEmail, limit = 20) {
  const attempts = db.prepare(`
    SELECT * FROM attempts
    WHERE user_email = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userEmail, limit);

  return attempts.map(a => ({
    id: a.id,
    title: a.exam_title,
    examSlug: a.exam_slug,
    points: a.points,
    total: a.total_points,
    percent: a.percent,
    correct: a.correct_count,
    incorrect: a.incorrect_count,
    auto: a.auto_submitted === 1,
    date: a.created_at,
    email: a.user_email
  }));
}

// Clear attempts for a user
function clearAttempts(userEmail) {
  const result = db.prepare('DELETE FROM attempts WHERE user_email = ?').run(userEmail);
  return result.changes;
}

// Get dashboard statistics
function getStats(userEmail) {
  const examCount = db.prepare('SELECT COUNT(*) as count FROM exams').get().count;

  let attemptStats;
  if (userEmail) {
    attemptStats = db.prepare(`
      SELECT COUNT(*) as count, MAX(percent) as best_score
      FROM attempts
      WHERE user_email = ?
    `).get(userEmail);
  } else {
    attemptStats = db.prepare(`
      SELECT COUNT(*) as count, MAX(percent) as best_score
      FROM attempts
    `).get();
  }

  return {
    availableExams: Number(examCount),
    attemptCount: Number(attemptStats.count || 0),
    bestScore: attemptStats.best_score !== null ? Number(attemptStats.best_score) : null
  };
}

// DB health & metadata
function getDatabaseStatus() {
  const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const examsCount = db.prepare('SELECT COUNT(*) as c FROM exams').get().c;
  const questionsCount = db.prepare('SELECT COUNT(*) as c FROM questions').get().c;
  const attemptsCount = db.prepare('SELECT COUNT(*) as c FROM attempts').get().c;

  return {
    connected: true,
    engine: 'SQLite 3 (Built-in Node.js Engine)',
    file: 'exam_portal.db',
    tables: {
      users: Number(usersCount),
      exams: Number(examsCount),
      questions: Number(questionsCount),
      attempts: Number(attemptsCount)
    }
  };
}

// Initialize on require
initDatabase();

module.exports = {
  db,
  initDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createSession,
  findSessionUser,
  deleteSession,
  getAllExams,
  getExamBySlug,
  gradeAndSaveAttempt,
  getAttempts,
  clearAttempts,
  getStats,
  getDatabaseStatus
};
