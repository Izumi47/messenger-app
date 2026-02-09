#!/bin/bash

# Private Messenger - Quick Start Script

echo "🔒 Private Messenger - Starting..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "📥 Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating default .env..."
    cat > .env << EOF
PORT=3000
JWT_SECRET=your-super-secret-key-change-this-in-production
NODE_ENV=production
EOF
    echo "⚠️  Please edit .env and change JWT_SECRET!"
fi

echo ""
echo "🚀 Starting server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Access at: http://localhost:3000"
echo "📡 For remote access: Set up port forwarding"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm start
