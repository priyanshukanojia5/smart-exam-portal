(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const storage = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  };

  // Local fallback exam data (used when server is offline)
  const localExamData = {
    dsa: {
      title: "Data Structures & Algorithms",
      time: 600,
      pointsPerQuestion: 2,
      questions: [
        { q: "Which data structure follows the LIFO principle?", options: ["Queue", "Stack", "Binary tree", "Graph"], answer: 1, explain: "A stack follows Last In, First Out (LIFO)." },
        { q: "What is the average time complexity of binary search on a sorted array?", options: ["O(n)", "O(1)", "O(log n)", "O(n log n)"], answer: 2, explain: "Binary search halves the search interval at every step." },
        { q: "Which data structure is commonly used for a first-in, first-out process?", options: ["Stack", "Queue", "Heap", "Hash table"], answer: 1, explain: "A queue removes elements in the same order they were inserted (FIFO)." },
        { q: "Which sorting algorithm repeatedly selects the smallest remaining element?", options: ["Bubble sort", "Merge sort", "Selection sort", "Quick sort"], answer: 2, explain: "Selection sort selects the minimum item from the unsorted portion each pass." },
        { q: "What does Big O notation primarily describe?", options: ["Exact runtime in seconds", "An upper bound on growth rate", "The programming language", "Memory address"], answer: 1, explain: "Big O describes an asymptotic upper bound on an algorithm's growth." }
      ]
    },
    java: {
      title: "Java Fundamentals",
      time: 480,
      pointsPerQuestion: 2,
      questions: [
        { q: "Which keyword is used to inherit a class in Java?", options: ["implements", "inherits", "extends", "super"], answer: 2, explain: "A class uses extends to inherit from another class." },
        { q: "Which method is the usual entry point of a Java application?", options: ["start()", "main()", "run()", "init()"], answer: 1, explain: "The standard entry point is public static void main(String[] args)." },
        { q: "Which of these is not a primitive Java type?", options: ["int", "boolean", "String", "double"], answer: 2, explain: "String is a class, not a primitive type." },
        { q: "Which collection does not allow duplicate elements?", options: ["ArrayList", "LinkedList", "HashSet", "Vector"], answer: 2, explain: "Set implementations such as HashSet store unique elements." },
        { q: "What does JVM stand for?", options: ["Java Variable Method", "Java Virtual Machine", "Joint Version Manager", "Java Visual Model"], answer: 1, explain: "The JVM executes Java bytecode." }
      ]
    },
    web: {
      title: "Web Development Basics",
      time: 480,
      pointsPerQuestion: 2,
      questions: [
        { q: "What does HTML stand for?", options: ["HyperText Markup Language", "High Transfer Machine Language", "Hyperlink Text Management Logic", "Home Tool Markup Language"], answer: 0, explain: "HTML stands for HyperText Markup Language." },
        { q: "Which CSS property changes text color?", options: ["font-style", "background", "color", "text-weight"], answer: 2, explain: "The color property sets an element's foreground/text color." },
        { q: "Which keyword declares a block-scoped variable that can be reassigned in JavaScript?", options: ["const", "let", "static", "define"], answer: 1, explain: "let declares a block-scoped variable that can be reassigned." },
        { q: "Which HTML element creates a hyperlink?", options: ["<link>", "<a>", "<href>", "<url>"], answer: 1, explain: "The anchor element <a> creates a hyperlink using href." },
        { q: "What is the DOM?", options: ["A CSS framework", "A database query", "A programming language", "An object representation of a document"], answer: 3, explain: "The DOM represents a document as a tree of objects that scripts can access." }
      ]
    }
  };

  // Base API URL configuration
  const API_BASE = window.location.protocol.startsWith("http") ? "" : "http://localhost:3000";
  let isBackendOnline = false;
  let token = storage.get("examly_token", null);

  let user = storage.get("examly_user", null);
  let accounts = storage.get("examly_accounts", []);
  let attempts = storage.get("examly_attempts", []);
  let authMode = "signin";
  let currentExam = null;
  let currentExamKey = "";
  let currentIndex = 0;
  let answers = [];
  let timerId = null;
  let secondsLeft = 0;
  let toastTimer = null;
  let lastResult = null;

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  function updateDbBadge(online, dbInfo) {
    const badge = $("#dbBadge");
    const text = $("#dbBadgeText");
    if (!badge || !text) return;
    if (online) {
      badge.className = "db-badge connected";
      const uCount = dbInfo?.tables?.users ?? 0;
      const aCount = dbInfo?.tables?.attempts ?? 0;
      badge.title = `SQLite Database Connected (${dbInfo?.file || "exam_portal.db"})\nUsers: ${uCount} | Attempts: ${aCount}`;
      text.textContent = "SQLite Connected";
    } else {
      badge.className = "db-badge offline";
      badge.title = "Backend server not detected. Running with browser local storage.";
      text.textContent = "Offline Mode";
    }
  }

  async function checkBackendStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/status`, {
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        const data = await res.json();
        isBackendOnline = true;
        updateDbBadge(true, data.database);
        return true;
      }
    } catch {
      // offline
    }
    isBackendOnline = false;
    updateDbBadge(false);
    return false;
  }

  async function syncSession() {
    if (!isBackendOnline || !token) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        user = data.user;
        storage.set("examly_user", user);
      } else {
        token = null;
        user = null;
        storage.set("examly_token", null);
        storage.set("examly_user", null);
      }
    } catch {
      // ignore network errors
    }
  }

  async function syncAttempts() {
    if (isBackendOnline) {
      try {
        const email = user ? user.email : "guest";
        const res = await fetch(`${API_BASE}/api/attempts?email=${encodeURIComponent(email)}`, {
          headers: authHeaders()
        });
        if (res.ok) {
          attempts = await res.json();
        }
      } catch (e) {
        console.warn("Could not sync attempts with backend:", e);
      }
    }
    renderUser();
  }

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function openDialog(id) {
    const d = $("#" + id);
    if (d && !d.open) d.showModal();
  }

  function closeDialog(id) {
    const d = $("#" + id);
    if (d?.open) d.close();
  }

  function scrollTo(id) {
    $("#" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function renderUser() {
    const signed = !!user;
    $("#headerLoginBtn").classList.toggle("hidden", signed);
    $("#logoutBtn").classList.toggle("hidden", !signed);
    $("#dashboardSignIn").classList.toggle("hidden", signed);
    $("#welcomeHeading").textContent = signed ? `Welcome back, ${user.name.split(" ")[0]}.` : "Ready when you are.";
    $("#dashboardIntro").textContent = signed ? "Your progress is saved in SQLite database. Keep building momentum." : "Sign in to track your attempts in the database, or jump straight into a practice exam.";
    $("#userSummary").classList.toggle("hidden", !signed);
    
    if (signed) {
      $("#userSummary").innerHTML = `<span>Signed in as <strong>${escapeHTML(user.name)}</strong> · ${escapeHTML(user.email)}</span><span>${isBackendOnline ? '🟢 Database Account' : 'Practice mode account'}</span>`;
    }

    const ownAttempts = attempts.filter(a => (signed ? a.email === user.email : a.email === "guest"));
    $("#attemptCount").textContent = ownAttempts.length;
    const best = ownAttempts.length ? Math.max(...ownAttempts.map(a => a.percent)) : null;
    $("#bestScore").textContent = best === null ? "—" : best + "%";
    $("#historyPanel").classList.toggle("hidden", ownAttempts.length === 0);
    $("#historyList").innerHTML = ownAttempts.slice(0, 5).map(a => `
      <div class="history-row">
        <strong>${escapeHTML(a.title)}</strong>
        <span>${a.percent}% · ${a.points}/${a.total} points · ${new Date(a.date).toLocaleDateString()}</span>
      </div>
    `).join("");
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";
    $("#authTitle").textContent = signup ? "Create your account" : "Sign in to your account";
    $("#authDescription").textContent = signup
      ? "Create an account saved directly to the SQLite database."
      : "Sign in to access your database-backed history and progress.";
    $("#authName").classList.toggle("hidden", !signup);
    $("#nameLabel").classList.toggle("hidden", !signup);
    $("#authName").required = signup;
    $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
    $("#authSubmit").textContent = signup ? "Create account" : "Sign in";
    $("#switchText").textContent = signup ? "Already have an account?" : "New to Examly?";
    $("#switchAuth").textContent = signup ? "Sign in" : "Create account";
    $("#authError").textContent = "";
  }

  function startAuth() {
    setAuthMode("signin");
    $("#authForm").reset();
    openDialog("authDialog");
  }

  $("#headerLoginBtn").addEventListener("click", startAuth);
  $("#dashboardSignIn").addEventListener("click", startAuth);
  $("#switchAuth").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));

  $("#togglePassword").addEventListener("click", () => {
    const input = $("#authPassword");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    $("#togglePassword").textContent = show ? "Hide" : "Show";
    $("#togglePassword").setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  $("#authForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#authEmail").value.trim().toLowerCase();
    const password = $("#authPassword").value;
    const name = $("#authName").value.trim();
    $("#authError").textContent = "";

    if (authMode === "signup") {
      if (name.length < 2) {
        $("#authError").textContent = "Please enter your name.";
        return;
      }
      if (password.length < 6) {
        $("#authError").textContent = "Use at least 6 characters for the password.";
        return;
      }

      if (isBackendOnline) {
        try {
          const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
          });
          const data = await res.json();
          if (!res.ok) {
            $("#authError").textContent = data.error || "Registration failed.";
            return;
          }
          user = data.user;
          token = data.token;
          storage.set("examly_user", user);
          storage.set("examly_token", token);
          toast("Account registered in SQLite database! Welcome, " + user.name);
        } catch (err) {
          $("#authError").textContent = "Connection error. Falling back to local storage.";
          accounts.push({ name, email, password });
          storage.set("examly_accounts", accounts);
          user = { name, email };
          storage.set("examly_user", user);
        }
      } else {
        if (accounts.some(a => a.email === email)) {
          $("#authError").textContent = "An account with this email already exists.";
          return;
        }
        accounts.push({ name, email, password });
        storage.set("examly_accounts", accounts);
        user = { name, email };
        storage.set("examly_user", user);
        toast("Account created locally. Welcome to Examly!");
      }
    } else {
      // Sign in mode
      if (isBackendOnline) {
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (!res.ok) {
            $("#authError").textContent = data.error || "Email or password not found.";
            return;
          }
          user = data.user;
          token = data.token;
          storage.set("examly_user", user);
          storage.set("examly_token", token);
          toast("Signed in via SQLite database.");
        } catch {
          const account = accounts.find(a => a.email === email && a.password === password);
          if (!account) {
            $("#authError").textContent = "Email or password not found.";
            return;
          }
          user = { name: account.name, email: account.email };
          storage.set("examly_user", user);
          toast("Signed in locally.");
        }
      } else {
        const account = accounts.find(a => a.email === email && a.password === password);
        if (!account) {
          $("#authError").textContent = "Email or password not found. Create an account first.";
          return;
        }
        user = { name: account.name, email: account.email };
        storage.set("examly_user", user);
        toast("Signed in successfully.");
      }
    }

    closeDialog("authDialog");
    await syncAttempts();
    await checkBackendStatus();
  });

  $("#logoutBtn").addEventListener("click", async () => {
    if (isBackendOnline && token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: authHeaders()
        });
      } catch {}
    }
    user = null;
    token = null;
    storage.set("examly_user", null);
    storage.set("examly_token", null);
    await syncAttempts();
    toast("You have signed out.");
  });

  $$("[data-close]").forEach(b => b.addEventListener("click", () => closeDialog(b.dataset.close)));

  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    storage.set("examly_dark", document.body.classList.contains("dark"));
    $("#themeToggle").textContent = document.body.classList.contains("dark") ? "☾" : "☼";
  });

  async function startExam(key) {
    currentExamKey = key;
    currentIndex = 0;

    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/exams/${key}`);
        if (res.ok) {
          currentExam = await res.json();
        } else {
          currentExam = localExamData[key];
        }
      } catch {
        currentExam = localExamData[key];
      }
    } else {
      currentExam = localExamData[key];
    }

    if (!currentExam) {
      toast("Error: Exam could not be loaded.");
      return;
    }

    answers = Array(currentExam.questions.length).fill(null);
    secondsLeft = currentExam.time || currentExam.timeLimit || 480;

    $("#examSubject").textContent = currentExam.title.toUpperCase();
    renderQuestion();
    openDialog("examDialog");
    updateTimer();

    clearInterval(timerId);
    timerId = setInterval(() => {
      secondsLeft--;
      updateTimer();
      if (secondsLeft <= 0) {
        clearInterval(timerId);
        finishExam(true);
      }
    }, 1000);
  }

  $$(".start-exam").forEach(b => b.addEventListener("click", () => startExam(b.dataset.exam)));
  $("#heroStartBtn").addEventListener("click", () => scrollTo("exams"));
  $("#ctaStartBtn").addEventListener("click", () => scrollTo("exams"));

  function renderQuestion() {
    const q = currentExam.questions[currentIndex];
    const n = currentExam.questions.length;
    $("#questionCountLabel").textContent = `QUESTION ${String(currentIndex + 1).padStart(2, "0")} OF ${String(n).padStart(2, "0")}`;
    $("#questionTitle").textContent = q.q;
    $("#questionHint").textContent = "Choose one answer. You can change it before submitting.";
    $("#answerOptions").innerHTML = q.options.map((opt, i) => `
      <button class="answer-option ${answers[currentIndex] === i ? "selected" : ""}" data-option="${i}">
        <span class="answer-letter">${String.fromCharCode(65 + i)}</span>
        <span>${escapeHTML(opt)}</span>
        ${answers[currentIndex] === i ? '<span class="check">✓</span>' : ""}
      </button>
    `).join("");

    $$(".answer-option").forEach(b => b.addEventListener("click", () => {
      answers[currentIndex] = Number(b.dataset.option);
      renderQuestion();
    }));

    $("#questionNav").innerHTML = currentExam.questions.map((_, i) => `
      <button class="q-nav-btn ${i === currentIndex ? "current" : ""} ${answers[i] !== null ? "answered" : ""}" data-q="${i}" aria-label="Go to question ${i + 1}">
        ${String(i + 1).padStart(2, "0")}
      </button>
    `).join("");

    $$(".q-nav-btn").forEach(b => b.addEventListener("click", () => {
      currentIndex = Number(b.dataset.q);
      renderQuestion();
    }));

    $("#answeredCount").textContent = `${answers.filter(a => a !== null).length} of ${n} answered`;
    $("#examProgressBar").style.width = `${(answers.filter(a => a !== null).length / n) * 100}%`;
    $("#prevQuestionBtn").disabled = currentIndex === 0;
    $("#prevQuestionBtn").style.opacity = currentIndex === 0 ? ".45" : "1";
    $("#nextQuestionBtn").classList.toggle("hidden", currentIndex === n - 1);
    $("#submitExamBtn").classList.toggle("hidden", currentIndex !== n - 1);
  }

  function updateTimer() {
    const m = Math.floor(Math.max(0, secondsLeft) / 60);
    const s = Math.max(0, secondsLeft) % 60;
    $("#examTimer").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    $("#examTimer").classList.toggle("warning", secondsLeft <= 60);
  }

  $("#prevQuestionBtn").addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  });

  $("#nextQuestionBtn").addEventListener("click", () => {
    if (currentIndex < currentExam.questions.length - 1) {
      currentIndex++;
      renderQuestion();
    }
  });

  $("#submitExamBtn").addEventListener("click", () => {
    const unanswered = answers.filter(a => a === null).length;
    if (unanswered && !confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) {
      return;
    }
    finishExam(false);
  });

  $("#exitExamBtn").addEventListener("click", () => {
    if (confirm("Exit this exam? Your current answers will not be saved.")) {
      clearInterval(timerId);
      closeDialog("examDialog");
    }
  });

  $("#examDialog").addEventListener("cancel", e => {
    if (!confirm("Exit this exam? Your current answers will not be saved.")) {
      e.preventDefault();
    } else {
      clearInterval(timerId);
    }
  });

  async function finishExam(auto = false) {
    clearInterval(timerId);
    closeDialog("examDialog");

    let resultData = null;

    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/exams/${currentExamKey}/submit`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            answers,
            auto,
            email: user ? user.email : "guest"
          })
        });
        if (res.ok) {
          resultData = await res.json();
          lastResult = resultData;
          toast("Attempt saved to SQLite database!");
        }
      } catch (err) {
        console.warn("Backend submit failed, calculating locally:", err);
      }
    }

    // Local grading fallback if backend was unavailable
    if (!resultData) {
      const qs = currentExam.questions;
      let correct = 0;
      qs.forEach((q, i) => {
        if (answers[i] === q.answer) correct++;
      });
      const points = correct * 2;
      const total = qs.length * 2;
      const percent = Math.round((correct / qs.length) * 100);

      const review = qs.map((q, i) => ({
        q: q.q,
        options: q.options,
        selectedAnswer: answers[i],
        correctAnswer: q.answer,
        isCorrect: answers[i] === q.answer,
        explain: q.explain
      }));

      resultData = {
        key: currentExamKey,
        title: currentExam.title,
        correct,
        incorrect: qs.length - correct,
        points,
        total,
        percent,
        answers: answers.slice(),
        auto,
        review
      };
      lastResult = resultData;

      const attempt = {
        title: currentExam.title,
        correct,
        points,
        total,
        percent,
        date: new Date().toISOString(),
        email: user ? user.email : "guest"
      };
      attempts.unshift(attempt);
      storage.set("examly_attempts", attempts);
    }

    await syncAttempts();
    await checkBackendStatus();

    // Render result dialog
    const percent = resultData.percent;
    $("#resultHeading").textContent = percent >= 80 ? "Excellent work!" : percent >= 50 ? "Good effort!" : "Keep practising!";
    $("#resultSubheading").textContent = auto ? "Time is up. Your exam was submitted automatically." : "Your result is recorded. Review your answers below.";
    $("#resultPercent").textContent = percent + "%";
    $("#scoreRing").style.setProperty("--score", percent + "%");
    $("#correctCount").textContent = resultData.correct;
    $("#incorrectCount").textContent = resultData.incorrect;
    $("#resultPoints").textContent = `${resultData.points}/${resultData.total}`;

    const reviews = resultData.review || [];
    $("#reviewList").innerHTML = reviews.map((r, i) => `
      <div class="review-item">
        <strong>${i + 1}. ${escapeHTML(r.q)}</strong>
        <div class="${r.isCorrect ? "right-answer" : "wrong-answer"}">
          ${r.selectedAnswer === null ? "Not answered" : r.isCorrect ? "Your answer: " + escapeHTML(r.options[r.correctAnswer]) + " ✓" : "Your answer: " + escapeHTML(r.options[r.selectedAnswer]) + " ✕"}
        </div>
        <div class="right-answer">Correct: ${escapeHTML(r.options[r.correctAnswer])}</div>
        <div style="color:var(--muted);margin-top:5px">${escapeHTML(r.explain)}</div>
      </div>
    `).join("");

    openDialog("resultDialog");
  }

  $("#retryExamBtn").addEventListener("click", () => {
    const key = lastResult?.key;
    closeDialog("resultDialog");
    if (key) startExam(key);
  });

  $("#closeResultBtn").addEventListener("click", () => {
    closeDialog("resultDialog");
    scrollTo("dashboard");
  });

  $("#copyResultBtn").addEventListener("click", async () => {
    if (!lastResult) return;
    const text = `Examly result — ${lastResult.title}\nScore: ${lastResult.percent}% (${lastResult.points}/${lastResult.total})\nCorrect: ${lastResult.correct}, Incorrect: ${lastResult.incorrect}`;
    try {
      await navigator.clipboard.writeText(text);
      toast("Result summary copied.");
    } catch {
      fallbackCopy(text);
    }
  });

  $("#copyLinkBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Page link copied.");
    } catch {
      fallbackCopy(location.href);
    }
  });

  function fallbackCopy(text) {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand("copy");
      toast("Copied to clipboard.");
    } catch {
      toast("Copy is unavailable in this browser.");
    }
    t.remove();
  }

  $("#printBtn").addEventListener("click", () => window.print());

  $("#clearHistoryBtn").addEventListener("click", async () => {
    if (!confirm("Clear your saved attempt history? This will delete your records from the database.")) return;
    if (isBackendOnline) {
      try {
        const email = user ? user.email : "guest";
        await fetch(`${API_BASE}/api/attempts?email=${encodeURIComponent(email)}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        toast("Database attempt history cleared.");
      } catch {
        toast("Could not clear database history.");
      }
    } else {
      attempts = attempts.filter(a => a.email !== (user ? user.email : "guest"));
      storage.set("examly_attempts", attempts);
      toast("Attempt history cleared.");
    }
    await syncAttempts();
    await checkBackendStatus();
  });

  window.addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    $("#scrollProgress").style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    $(".site-header").classList.toggle("scrolled", scrollY > 10);
  });

  $("#lastUpdated").textContent = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date());
  $("#year").textContent = new Date().getFullYear();

  if (storage.get("examly_dark", false)) {
    document.body.classList.add("dark");
    $("#themeToggle").textContent = "☾";
  }

  function hideLoader() {
    const el = $("#loader");
    if (el) el.classList.add("done");
  }

  // Initialization lifecycle
  async function init() {
    setTimeout(hideLoader, 500);
    renderUser();
    try {
      await checkBackendStatus();
      await syncSession();
      await syncAttempts();
    } catch (e) {
      console.warn("Backend sync error:", e);
    } finally {
      hideLoader();
    }
  }

  init();
})();
