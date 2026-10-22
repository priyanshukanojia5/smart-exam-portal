const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 1. Read sources
const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// Verify JS is valid syntax
try {
  new vm.Script(js);
  console.log('✅ app.js syntax verified: 100% valid JavaScript!');
} catch (e) {
  console.error('❌ app.js syntax error:', e.message);
  process.exit(1);
}

// 2. Base clean HTML template
const htmlTemplate = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b1020">
  <title>Examly — Online Examination System</title>
  <link rel="stylesheet" href="style.css">
  <style>
${css}
  </style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div id="scrollProgress" class="scroll-progress"></div>
  <div id="loader" class="loader-screen" aria-label="Loading application">
    <div class="loader-mark">E</div>
    <div class="spinner"></div>
    <p>Preparing your exam workspace…</p>
  </div>
  <script>
    // Immediate failsafe: hide loader after 500ms guaranteed
    setTimeout(function() {
      var l = document.getElementById('loader');
      if (l) l.classList.add('done');
    }, 500);
  </script>

  <header class="site-header">
    <a class="brand" href="#" aria-label="Examly home"><span class="brand-icon">E</span><span>examly<span class="brand-dot">.</span></span></a>
    <nav class="main-nav" aria-label="Main navigation">
      <a href="#dashboard">Dashboard</a><a href="#exams">Exams</a><a href="#how-it-works">How it works</a>
    </nav>
    <div class="header-actions">
      <div id="dbBadge" class="db-badge" title="Database status"><span class="db-dot"></span><span id="dbBadgeText">SQLite DB</span></div>
      <button id="themeToggle" class="icon-btn" aria-label="Toggle dark mode" title="Toggle theme">☼</button>
      <button id="logoutBtn" class="btn btn-quiet hidden">Sign out</button>
      <button id="headerLoginBtn" class="btn btn-primary">Sign in</button>
    </div>
  </header>

  <main id="main">
    <section id="hero" class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><span class="pulse-dot"></span> YOUR SMART EXAM SPACE</div>
        <h1>Make every exam<br><span class="gradient-text">count.</span></h1>
        <p class="hero-subtitle">A calmer, smarter way to take assessments. Practice, track your progress, and get your results in seconds.</p>
        <div class="hero-actions"><button class="btn btn-primary btn-lg" id="heroStartBtn">Explore exams <span>→</span></button><a class="text-link" href="#how-it-works">See how it works ↗</a></div>
        <div class="trust-row"><div class="avatar-stack"><span>A</span><span>R</span><span>S</span><span>+</span></div><div><strong>Built for focused learning</strong><small>Practice at your own pace</small></div></div>
      </div>
      <div class="hero-visual">
        <div class="orb orb-one"></div><div class="orb orb-two"></div>
        <div class="exam-preview">
          <div class="preview-top"><span class="preview-pill"><i></i> LIVE PREVIEW</span><span class="preview-dots">•••</span></div>
          <div class="preview-title">Data Structures & Algorithms <span class="mini-tag">PRACTICE</span></div>
          <div class="preview-meta"><span>◷ 15 minutes</span><span>▤ 5 questions</span></div>
          <div class="preview-line"></div>
          <p class="question-label">QUESTION 01 <span>01 / 05</span></p>
          <h3>Which data structure follows the LIFO principle?</h3>
          <div class="preview-option selected"><span class="option-letter">A</span> Stack <span class="check">✓</span></div>
          <div class="preview-option"><span class="option-letter">B</span> Queue</div>
          <div class="preview-option"><span class="option-letter">C</span> Linked List</div>
          <div class="preview-footer"><span>● Progress saved locally</span><span class="preview-next">Next →</span></div>
        </div>
        <div class="floating-card score-card"><span class="float-icon">✦</span><div><strong>Instant results</strong><small>Review every answer</small></div></div>
        <div class="floating-card secure-card"><span class="secure-icon">✓</span><div><strong>Focused learning</strong><small>Your progress, at a glance</small></div></div>
      </div>
    </section>

    <section class="stats-strip" aria-label="Platform highlights">
      <div><strong>01</strong><span>Simple sign in</span></div><div><strong>02</strong><span>Timed assessments</span></div><div><strong>03</strong><span>Instant scoring</span></div><div><strong>04</strong><span>Progress history</span></div>
    </section>

    <section id="dashboard" class="section dashboard-section">
      <div class="section-heading"><div><div class="eyebrow">YOUR LEARNING SPACE</div><h2 id="welcomeHeading">Ready when you are.</h2><p id="dashboardIntro">Sign in to track your attempts in the database, or jump straight into a practice exam.</p></div><button id="dashboardSignIn" class="btn btn-outline">Sign in to save progress</button></div>
      <div id="userSummary" class="user-summary hidden"></div>
      <div class="dashboard-grid">
        <article class="metric-card"><div class="metric-icon purple">▣</div><span class="metric-label">Available exams</span><strong>03</strong><small>Curated practice sets</small></article>
        <article class="metric-card"><div class="metric-icon green">✓</div><span class="metric-label">Your attempts</span><strong id="attemptCount">0</strong><small>Completed assessments</small></article>
        <article class="metric-card"><div class="metric-icon orange">↗</div><span class="metric-label">Best score</span><strong id="bestScore">—</strong><small>Across completed exams</small></article>
      </div>
      <div id="historyPanel" class="history-panel hidden"><div class="panel-heading"><h3>Recent attempts</h3><button id="clearHistoryBtn" class="text-button">Clear history</button></div><div id="historyList"></div></div>
    </section>

    <section id="exams" class="section exams-section">
      <div class="section-heading"><div><div class="eyebrow">PICK YOUR CHALLENGE</div><h2>Find your next <span class="gradient-text">test.</span></h2><p>Short, focused assessments to help you learn by doing.</p></div><div class="exam-filter"><span>Showing</span><strong>All exams</strong><span>⌄</span></div></div>
      <div class="exam-grid">
        <article class="exam-card featured-exam">
          <div class="exam-art art-purple"><span class="art-symbol">⌘</span><span class="art-chip">MOST POPULAR</span><div class="art-grid"></div></div>
          <div class="exam-card-content"><div class="card-tags"><span>COMPUTER SCIENCE</span><span class="level level-mid">INTERMEDIATE</span></div><h3>Data Structures & Algorithms</h3><p>Stacks, queues, searching, sorting, and complexity basics.</p><div class="exam-details"><span>◷ 10 min</span><span>▤ 5 questions</span><span>★ 10 points</span></div><button class="btn btn-primary full-width start-exam" data-exam="dsa">Start exam <span>→</span></button></div>
        </article>
        <article class="exam-card">
          <div class="exam-art art-blue"><span class="art-symbol">{" }</span><span class="art-chip">FOUNDATION</span><div class="art-grid"></div></div>
          <div class="exam-card-content"><div class="card-tags"><span>PROGRAMMING</span><span class="level level-easy">BEGINNER</span></div><h3>Java Fundamentals</h3><p>Test your understanding of Java syntax and core concepts.</p><div class="exam-details"><span>◷ 8 min</span><span>▤ 5 questions</span><span>★ 10 points</span></div><button class="btn btn-primary full-width start-exam" data-exam="java">Start exam <span>→</span></button></div>
        </article>
        <article class="exam-card">
          <div class="exam-art art-green"><span class="art-symbol">⌬</span><span class="art-chip">QUICK PRACTICE</span><div class="art-grid"></div></div>
          <div class="exam-card-content"><div class="card-tags"><span>WEB TECHNOLOGY</span><span class="level level-easy">BEGINNER</span></div><h3>Web Development Basics</h3><p>HTML, CSS, JavaScript, and the foundations of the web.</p><div class="exam-details"><span>◷ 8 min</span><span>▤ 5 questions</span><span>★ 10 points</span></div><button class="btn btn-primary full-width start-exam" data-exam="web">Start exam <span>→</span></button></div>
        </article>
      </div>
    </section>

    <section id="how-it-works" class="section how-section">
      <div class="section-heading centered"><div><div class="eyebrow">MADE TO FEEL SIMPLE</div><h2>From start to <span class="gradient-text">score.</span></h2><p>No clutter. No confusion. Just you and the questions.</p></div></div>
      <div class="steps-grid"><div class="step"><span class="step-number">01</span><div class="step-icon">↗</div><h3>Choose an exam</h3><p>Pick a topic and check the time limit before you begin.</p></div><div class="step"><span class="step-number">02</span><div class="step-icon">◉</div><h3>Focus and answer</h3><p>Navigate questions, mark your choices, and watch the timer.</p></div><div class="step"><span class="step-number">03</span><div class="step-icon">✧</div><h3>Learn from results</h3><p>Get your score and review correct answers instantly.</p></div></div>
    </section>
    <section class="cta-section"><div><div class="eyebrow">YOUR NEXT STEP STARTS HERE</div><h2>Small practice.<br><span class="gradient-text">Big progress.</span></h2><p>Build confidence one question at a time.</p></div><button class="btn btn-light btn-lg" id="ctaStartBtn">Choose an exam <span>→</span></button><div class="cta-decoration">E</div></section>
  </main>

  <footer class="site-footer"><a class="brand" href="#"><span class="brand-icon">E</span><span>examly<span class="brand-dot">.</span></span></a><p>Practice with purpose. Learn with confidence.</p><div class="footer-right"><span>Last updated: <time id="lastUpdated"></time></span><span>© <span id="year"></span> Examly</span><button id="copyLinkBtn" class="text-button">Copy page link</button><button id="printBtn" class="text-button">Print</button></div></footer>

  <!-- Authentication modal -->
  <dialog id="authDialog" class="modal">
    <form id="authForm" class="modal-card">
      <button type="button" class="modal-close" data-close="authDialog" aria-label="Close">×</button>
      <div class="modal-brand"><span class="brand-icon">E</span></div>
      <div class="eyebrow">WELCOME TO EXAMLY</div><h2 id="authTitle">Sign in to your account</h2><p id="authDescription">Save your attempts and see your progress over time.</p>
      <div class="field"><label for="authName" id="nameLabel" class="hidden">Full name</label><input id="authName" class="hidden" type="text" autocomplete="name" placeholder="Your full name"></div>
      <div class="field"><label for="authEmail">Email address</label><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" required></div>
      <div class="field"><label for="authPassword">Password</label><div class="password-wrap"><input id="authPassword" type="password" autocomplete="current-password" placeholder="At least 6 characters" minlength="6" required><button type="button" id="togglePassword" class="password-toggle" aria-label="Show password">Show</button></div></div>
      <p id="authError" class="form-error" role="alert"></p>
      <button type="submit" id="authSubmit" class="btn btn-primary full-width">Sign in</button>
      <p class="switch-auth"><span id="switchText">New to Examly?</span> <button type="button" id="switchAuth" class="text-button">Create account</button></p>
      <p class="demo-note" id="authModeNote">Connected to SQLite Database. Demo: <strong>student@examly.com</strong> / <strong>password123</strong></p>
    </form>
  </dialog>

  <!-- Exam modal -->
  <dialog id="examDialog" class="modal exam-modal">
    <div class="exam-shell">
      <div class="exam-topbar"><a class="brand" href="#"><span class="brand-icon">E</span><span>examly<span class="brand-dot">.</span></span></a><div class="exam-top-meta"><span id="examSubject">PRACTICE EXAM</span><span class="timer" id="examTimer">10:00</span><button class="icon-btn" id="exitExamBtn" aria-label="Exit exam">×</button></div></div>
      <div class="exam-progress-track"><div id="examProgressBar"></div></div>
      <div class="exam-body"><aside class="question-sidebar"><span class="eyebrow">YOUR QUESTIONS</span><div id="questionNav" class="question-nav"></div><div class="sidebar-tip"><span>✦</span><strong>Take your time</strong><p>Read each question carefully. You can revisit answers before submitting.</p></div></aside>
        <section class="question-area"><div class="question-meta"><span id="questionCountLabel">QUESTION 01 OF 05</span><span class="points-label">2 POINTS</span></div><h2 id="questionTitle">Question text</h2><p id="questionHint" class="question-hint">Choose one answer.</p><div id="answerOptions" class="answer-options"></div><div class="question-actions"><button id="prevQuestionBtn" class="btn btn-outline">← Previous</button><span id="answeredCount">0 of 5 answered</span><button id="nextQuestionBtn" class="btn btn-primary">Next question →</button><button id="submitExamBtn" class="btn btn-primary hidden">Submit exam ✓</button></div></section>
      </div>
    </div>
  </dialog>

  <!-- Result modal -->
  <dialog id="resultDialog" class="modal">
    <div class="modal-card result-card"><button type="button" class="modal-close" data-close="resultDialog" aria-label="Close">×</button><div class="result-badge">✦</div><div class="eyebrow">EXAM COMPLETED</div><h2 id="resultHeading">Nicely done!</h2><p id="resultSubheading">Here is how you did.</p><div class="score-ring" id="scoreRing"><div><strong id="resultPercent">80%</strong><span>YOUR SCORE</span></div></div><div class="result-stats"><div><strong id="correctCount">4</strong><span>Correct</span></div><div><strong id="incorrectCount">1</strong><span>Incorrect</span></div><div><strong id="resultPoints">8/10</strong><span>Points</span></div></div><div id="reviewList" class="review-list"></div><div class="result-actions"><button id="retryExamBtn" class="btn btn-outline">Try again</button><button id="closeResultBtn" class="btn btn-primary">Back to dashboard</button></div><button id="copyResultBtn" class="text-button">Copy result summary</button></div>
  </dialog>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <script>
${js}
  </script>
</body>
</html>`;

// 3. Write index.html
fs.writeFileSync(path.join(__dirname, 'index.html'), htmlTemplate, 'utf8');

// 4. Populate public/ folder
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}
fs.writeFileSync(path.join(publicDir, 'index.html'), htmlTemplate, 'utf8');
fs.writeFileSync(path.join(publicDir, 'style.css'), css, 'utf8');
fs.writeFileSync(path.join(publicDir, 'app.js'), js, 'utf8');

console.log('🎉 Successfully created self-contained index.html and public/ directory!');
console.log('   - Built size: ' + Math.round(htmlTemplate.length / 1024) + ' KB');
