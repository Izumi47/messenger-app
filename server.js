const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Trust proxy - required for ngrok X-Forwarded-For header
// This tells Express to trust the proxy (ngrok) and use X-Forwarded-For for client IP
app.set('trust proxy', 1);

// Determine allowed origins based on environment
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000'
];

// Add ngrok domain if it exists
if (process.env.NGROK_URL) {
  ALLOWED_ORIGINS.push(process.env.NGROK_URL);
}

const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// CORS Configuration
const corsOptions = {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Security Headers
app.use((req, res, next) => {
  // HSTS - Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // CSP - Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://cdn.socket.io; connect-src 'self' wss: ws:");
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window for auth
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for general API
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't count WebSocket connections in rate limit
    return req.headers.upgrade === 'websocket';
  }
});

// Set correct MIME types for PWA
app.use((req, res, next) => {
  if (req.path.endsWith('.json')) {
    res.type('application/json');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Environment
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const DB_PATH = './messages.db';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const VAPID_PATH = path.join(__dirname, 'vapid.json');

function loadOrCreateVapidKeys() {
  if (fs.existsSync(VAPID_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_PATH, 'utf8'));
  }

  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_PATH, JSON.stringify(keys, null, 2));
  console.log('✅ Generated new VAPID keys');
  return keys;
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails(VAPID_SUBJECT, vapidKeys.publicKey, vapidKeys.privateKey);

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

const saveSubscription = async (userId, subscription) => {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Invalid subscription payload');
  }

  await dbRun(
    `INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)` ,
    [userId, endpoint, keys.p256dh, keys.auth]
  );
};

const removeSubscription = async (endpoint) => {
  await dbRun('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
};

const sendPushToUser = async (userId, payload) => {
  const subscriptions = await dbAll(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    [userId]
  );

  if (!subscriptions.length) {
    return;
  }

  const message = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };

      try {
        await webpush.sendNotification(subscription, message);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await removeSubscription(sub.endpoint);
        } else {
          console.error('Web Push error:', err.message);
        }
      }
    })
  );
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

    await dbRun(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// ==================== AUTH ROUTES ====================

// Input validation helper
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return 'Username is required';
  }
  if (username.length < 3 || username.length > 30) {
    return 'Username must be 3-30 characters long';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  return null;
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (password.length > 128) {
    return 'Password must be less than 128 characters';
  }
  return null;
};

// Register
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
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
app.post('/api/login', authLimiter, async (req, res) => {
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

// ==================== WEB PUSH ROUTES ====================

app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    await saveSubscription(req.userId, subscription);
    res.json({ message: 'Subscription saved' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/push/unsubscribe', verifyToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }
    await removeSubscription(endpoint);
    res.json({ message: 'Subscription removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MESSAGE ROUTES ====================

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

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

    await sendPushToUser(toUserId, {
      title: `💬 ${req.username}`,
      body: content?.substring(0, 100) || 'New message',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: `message-${req.userId}`,
      data: {
        fromUserId: req.userId,
        username: req.username,
        url: '/'
      }
    });

    res.json({ message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete message
app.delete('/api/messages/:messageId', verifyToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Verify the message belongs to the current user
    const message = await dbGet('SELECT from_user_id, to_user_id FROM messages WHERE id = ?', [messageId]);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    if (message.from_user_id !== req.userId) {
      return res.status(403).json({ error: 'Cannot delete message sent by another user' });
    }
    
    await dbRun('DELETE FROM messages WHERE id = ?', [messageId]);

    const payload = { messageId, fromUserId: message.from_user_id, toUserId: message.to_user_id };
    io.to(`user-${message.from_user_id}`).emit('message-deleted', payload);
    io.to(`user-${message.to_user_id}`).emit('message-deleted', payload);

    res.json({ message: 'Message deleted' });
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
      const result = await dbRun(
        'INSERT INTO messages (from_user_id, to_user_id, content) VALUES (?, ?, ?)',
        [socket.userId, toUserId, content]
      );

      const messageId = result.lastID;
      const timestamp = new Date().toISOString();

      // Send to recipient in real-time
      io.to(`user-${toUserId}`).emit('new-message', {
        id: messageId,
        fromUserId: socket.userId,
        fromUsername: socket.username,
        toUserId,
        content,
        timestamp
      });

      await sendPushToUser(toUserId, {
        title: `💬 ${socket.username}`,
        body: content?.substring(0, 100) || 'New message',
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        tag: `message-${socket.userId}`,
        data: {
          fromUserId: socket.userId,
          username: socket.username,
          url: '/'
        }
      });

      // Confirm to sender
      socket.emit('message-sent', { id: messageId, toUserId, content, timestamp });
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ==================== SERVER ====================

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🔒 Private Messenger Server running on port ${PORT}`);
  console.log(`📍 Local access: http://localhost:${PORT}`);
  console.log(`📱 Network access: http://192.168.100.5:${PORT}`);
  console.log(`🔐 Remember to change JWT_SECRET in production!\n`);
});

module.exports = app;
