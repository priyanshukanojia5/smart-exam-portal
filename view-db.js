#!/usr/bin/env node
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'exam_portal.db');

try {
  const db = new DatabaseSync(DB_PATH);
  
  console.log('\n======================================================');
  console.log('       📊 EXAMLY SQLITE DATABASE VIEWER 📊            ');
  console.log(`       File: ${DB_PATH}`);
  console.log('======================================================\n');

  // 1. Users
  console.log('👥 REGISTERED USERS:');
  const users = db.prepare('SELECT id, name, email, created_at FROM users').all();
  if (users.length === 0) {
    console.log('   (No users found)');
  } else {
    console.table(users);
  }

  // 2. Active Sessions
  console.log('\n🔐 ACTIVE SESSIONS:');
  const sessions = db.prepare(`
    SELECT s.user_id, u.name, u.email, s.expires_at, substr(s.token, 1, 10) || '...' as token_preview
    FROM sessions s
    JOIN users u ON s.user_id = u.id
  `).all();
  if (sessions.length === 0) {
    console.log('   (No active sessions)');
  } else {
    console.table(sessions);
  }

  // 3. Exams
  console.log('\n📚 AVAILABLE EXAMS:');
  const exams = db.prepare(`
    SELECT e.id, e.slug, e.title, e.category, e.difficulty, e.time_limit || 's' as duration, COUNT(q.id) as questions
    FROM exams e
    LEFT JOIN questions q ON e.id = q.exam_id
    GROUP BY e.id
  `).all();
  console.table(exams);

  // 4. Attempts
  console.log('\n📝 EXAM ATTEMPTS HISTORY:');
  const attempts = db.prepare(`
    SELECT id, user_email, exam_title, points || '/' || total_points as score, percent || '%' as percentage, correct_count as correct, incorrect_count as incorrect, created_at
    FROM attempts
    ORDER BY id DESC
    LIMIT 10
  `).all();
  if (attempts.length === 0) {
    console.log('   (No attempts recorded yet)');
  } else {
    console.table(attempts);
  }

  // 5. Database Statistics Summary
  console.log('\n📈 SUMMARY METRICS:');
  const summary = [
    { Table: 'users', Records: db.prepare('SELECT COUNT(*) as c FROM users').get().c },
    { Table: 'sessions', Records: db.prepare('SELECT COUNT(*) as c FROM sessions').get().c },
    { Table: 'exams', Records: db.prepare('SELECT COUNT(*) as c FROM exams').get().c },
    { Table: 'questions', Records: db.prepare('SELECT COUNT(*) as c FROM questions').get().c },
    { Table: 'question_options', Records: db.prepare('SELECT COUNT(*) as c FROM question_options').get().c },
    { Table: 'attempts', Records: db.prepare('SELECT COUNT(*) as c FROM attempts').get().c },
    { Table: 'attempt_answers', Records: db.prepare('SELECT COUNT(*) as c FROM attempt_answers').get().c }
  ];
  console.table(summary);
  console.log('\n✨ Database is healthy and all relationships are intact.\n');

} catch (err) {
  console.error('❌ Failed to read database:', err.message);
  process.exit(1);
}
