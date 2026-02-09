const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Environment
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const DB_PATH = './messages.db';

// Initialize SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Helper to promisify database calls
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize Database Tables
async function initializeDatabase() {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(from_user_id) REFERENCES users(id),
        FOREIGN KEY(to_user_id) REFERENCES users(id)
      )
    `);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    
    await dbRun(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hashedPassword]
    );

    res.json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await dbGet('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcryptjs.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  });
};

// ==================== MESSAGE ROUTES ====================

// Get all users
app.get('/api/users', verifyToken, async (req, res) => {
  try {
    const users = await dbAll('SELECT id, username FROM users WHERE id != ?', [req.userId]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversation with a user
app.get('/api/messages/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await dbAll(
      `SELECT id, from_user_id, to_user_id, content, created_at FROM messages 
       WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
       ORDER BY created_at ASC`,
      [req.userId, userId, userId, req.userId]
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message (HTTP POST - for non-WebSocket clients)
app.post('/api/messages', verifyToken, async (req, res) => {
  try {
    const { toUserId, content } = req.body;

    await dbRun(
      'INSERT INTO messages (from_user_id, to_user_id, content) VALUES (?, ?, ?)',
      [req.userId, toUserId, content]
    );

    res.json({ message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== WEBSOCKET EVENTS ====================

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // When user joins with their token
  socket.on('join', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.join(`user-${decoded.userId}`);
      console.log(`${decoded.username} joined`);
    } catch (err) {
      socket.emit('error', 'Invalid token');
    }
  });

  // Handle incoming messages
  socket.on('send-message', async (data) => {
    try {
      const { toUserId, content } = data;

      // Save to database
      await dbRun(
        'INSERT INTO messages (from_user_id, to_user_id, content) VALUES (?, ?, ?)',
        [socket.userId, toUserId, content]
      );

      // Send to recipient in real-time
      io.to(`user-${toUserId}`).emit('new-message', {
        fromUserId: socket.userId,
        fromUsername: socket.username,
        toUserId,
        content,
        timestamp: new Date().toISOString()
      });

      // Confirm to sender
      socket.emit('message-sent', { toUserId, content });
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ==================== SERVER ====================

server.listen(PORT, () => {
  console.log(`\n🔒 Private Messenger Server running on ${PORT}`);
  console.log(`📍 Access at: http://localhost:${PORT}`);
  console.log(`🔐 Remember to change JWT_SECRET in production!\n`);
});

module.exports = app;
