#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "======================================================"
echo "          Examly — Online Examination System          "
echo "======================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js is required to run this system."
  echo "👉 Please install Node.js from https://nodejs.org/"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 Installing required packages..."
  npm install
fi

echo "🚀 Starting server at http://localhost:3000 ..."
npm start
