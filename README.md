# 🔒 Private Messenger - Self-Hosted Edition

A completely private, self-hosted messaging application built with Node.js, Express, Socket.io, and SQLite. All data stays on **your** server—no third parties involved.

## Features

✅ **End-to-End Control** - All messages stored locally on your server
✅ **Real-time Messaging** - WebSocket-based instant message delivery
✅ **User Authentication** - Secure login with JWT tokens
✅ **Password Security** - Bcrypt hashing for all passwords
✅ **One-on-One Chat** - Private conversations between users
✅ **Message History** - Full conversation persistence
✅ **Message Management** - Delete individual or multiple messages at once
✅ **Message Actions** - Long-press context menu to copy or delete messages
✅ **Easy Deployment** - Simple setup for home server or VPS
✅ **PWA Notifications** - Works while app is open or in background (closed app requires Web Push)

## System Requirements

- **Node.js** 14+ (https://nodejs.org/)
- **NPM** (comes with Node.js)
- Any OS: Windows, macOS, Linux
- **For remote access**: Router with port forwarding capability

## Installation

### 1. Clone or Download the Project

```bash
git clone <repo-url> messenger-app
cd messenger-app
```

Or extract the provided folder.

### 2. Install Dependencies

```bash
npm install
```

This installs: Express, Socket.io, SQLite3, bcryptjs, JWT, and CORS.

### 3. Configure Environment

Edit `.env` file:

```env
PORT=3000
JWT_SECRET=your-super-secret-key-change-this-in-production
NODE_ENV=production
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` to something random and strong:
```
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 4. Start the Server

**Easiest (Windows) - Auto-starts server + ngrok**:
```bash
start.bat
```
This automatically opens ngrok tunnel to: `https://thrush-close-civet.ngrok-free.app`

**Manual start**:
```bash
npm start
```

Then in another terminal:
```bash
ngrok http --domain=thrush-close-civet.ngrok-free.app 3000
```

You should see:
```
🔒 Private Messenger Server running on 3000
📍 Local: http://localhost:3000
🌐 Remote: https://thrush-close-civet.ngrok-free.app
```

## Usage

1. **Open in Browser**: 
   - Local: `http://localhost:3000`
   - Remote: `https://thrush-close-civet.ngrok-free.app`
2. **First Time**:
   - Click "Register"
   - Create username and password
   - Click "Login"
3. **Messaging**:
   - Select a user from the left sidebar
   - Type message in the input box
   - Press Enter or click Send
   - Messages appear in real-time

## Architecture

```
┌─────────────────────────────────────────┐
│  Web Browser (Desktop/Mobile)           │
│  - HTML/CSS/JS Frontend                 │
│  - Socket.io Client                     │
└──────────────┬──────────────────────────┘
               │
        HTTP + WebSocket
               │
┌──────────────▼──────────────────────────┐
│  Node.js Backend Server                 │
│  - Express.js API                       │
│  - Socket.io Server                     │
│  - JWT Authentication                   │
└──────────────┬──────────────────────────┘
               │
        SQLite Database
               │
┌──────────────▼──────────────────────────┐
│  messages.db (Local SQLite)             │
│  - Users Table                          │
│  - Messages Table                       │
└─────────────────────────────────────────┘
```

## Data Storage

All data is stored in `messages.db` SQLite database:

- **Users**: Username, hashed password
- **Messages**: Sender ID, Recipient ID, Content, Timestamp

File location: `./messages.db` (in the app directory)

## API Endpoints

### Authentication
- `POST /api/register` - Create new account
- `POST /api/login` - Login and get JWT token

### Users & Messages
- `GET /api/users` - List all users (requires auth)
- `GET /api/messages/:userId` - Get conversation history (requires auth)
- `POST /api/messages` - Send message (requires auth)

### WebSocket Events
- `join` - Connect with JWT token
- `send-message` - Send message in real-time
- `new-message` - Receive incoming message

## Remote Access Setup

### ✅ Current Setup: Ngrok (Recommended & Active)

This app is configured to use **ngrok** for remote access:
- Domain: `https://thrush-close-civet.ngrok-free.app`
- Automatic HTTPS
- No port forwarding needed
- Works behind any firewall/router

**To start:**
```bash
start.bat  # Automatically starts both server and ngrok
```

### Alternative: Port Forwarding (If not using ngrok)

**On Your Router:**

1. Log into router admin panel (usually `192.168.1.1` or `192.168.0.1`)
2. Find "Port Forwarding"
3. Forward external port `8000` → internal IP `192.168.1.X:3000`
   - Replace `X` with your computer's local IP
4. Find your public IP: https://whatismyipaddress.com

**Users access via**: `http://YOUR_PUBLIC_IP:8000`

⚠️ **Security Warnings**:
- Your home IP can be used to locate you
- Server is on your home network
- Regularly update Node.js and dependencies

### Option 2: Dynamic DNS + Port Forwarding (Recommended)

1. **Set up DuckDNS** (free):
   - Go to https://www.duckdns.org
   - Sign up with email
   - Add new domain: `myname.duckdns.org`
   - Update IP automatically with local script:

   ```bash
   # Windows (save as update-dns.bat and run periodically)
   curl "https://www.duckdns.org/update?domains=myname&token=YOUR_TOKEN&ip="
   ```

2. **Enable HTTPS** (important for security):
   ```bash
   npm install --save certbot letsencrypt
   ```

3. **Users access via**: `https://myname.duckdns.org:8000`

### Option 3: VPN Tunnel (Most Secure)

Require users to connect to your home VPN first:

1. **Set up WireGuard** on your server
2. Users connect to VPN
3. Access messenger via local IP: `http://192.168.1.X:3000`

This keeps your server completely private.

## Security Best Practices

### 1. Change JWT Secret ✅
Edit `.env` and use a strong random secret:
```
JWT_SECRET=YOUR_CRYPTOGRAPHICALLY_SECURE_RANDOM_STRING
```

### 2. Use HTTPS/TLS
For port forwarding, encrypt traffic with Let's Encrypt:
```bash
# Install certbot and generate certificate
npm install --save express-https
```

### 3. Regular Backups
Backup `messages.db` regularly:
```bash
# Windows
copy messages.db messages.db.backup
```

### 4. Firewall Rules
Only allow port 3000/8000 from specific IPs if possible.

### 5. Update Dependencies
```bash
npm update
```

### 6. Use Strong Passwords
Enforce strong passwords for accounts.

### 7. Monitor Activity
Check for unusual login attempts by adding logging.

## Database

SQLite database is automatically created on first run: `messages.db`

### Backup Database
```bash
# Create backup
cp messages.db messages.db.$(date +%Y%m%d).backup

# Restore from backup
cp messages.db.20260209.backup messages.db
```

## Troubleshooting

### Port Already in Use
```bash
# Windows - Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### Cannot Access from Outside
1. Verify port forwarding is enabled on router
2. Check firewall isn't blocking port
3. Verify public IP is correct: `https://whatismyipaddress.com`
4. Make sure server is running: `npm start`

### Database Locked Error
- Close other instances of the app
- Delete `messages.db` and restart (loses historical data)

### Messages Not Sending
1. Check browser console (F12)
2. Verify socket connection
3. Check server logs for errors
4. Restart server

## Running on Home Network

For **same WiFi** access only (simplest):

1. Find your local IP:
   ```bash
   # Windows
   ipconfig
   # Look for "IPv4 Address"
   ```

2. Other devices access via: `http://192.168.1.X:3000`

## Advanced: HTTPS with Self-Signed Certificate

For more secure remote access:

```bash
# Install necessary packages
npm install --save https

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

Update `server.js`:
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem')
};

https.createServer(options, app).listen(PORT);
```

Users will see warning (expected with self-signed cert).

## Performance Tips

- For 50+ users: Consider upgrading from SQLite to PostgreSQL
- Add message pagination (currently loads all history)
- Implement message archiving for old conversations
- Add read receipts / typing indicators

## Future Enhancements

- [ ] Group chat support
- [ ] File sharing
- [ ] Voice/video calls (WebRTC)
- [ ] Message encryption (Signal Protocol)
- [ ] Native Android/iOS apps (React Native or Flutter)
- [ ] Web Push for notifications when app is fully closed
- [ ] User profiles/avatars
- [ ] Message search
- [ ] User activity status

## License

MIT - Free to use and modify

## Support

- Check console logs: `npm start` and watch for errors
- Verify database: Check if `messages.db` file exists
- Test locally first before enabling port forwarding

---

**Remember**: You are responsible for:
- Keeping server online 24/7
- Securing your server
- Managing backups
- Updating Node.js dependencies
- Monitoring network access

Enjoy your **completely private** messenger! 🔒
