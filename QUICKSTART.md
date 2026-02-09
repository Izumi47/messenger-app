# 🚀 Quick Reference

## Starting the App

**Windows (Recommended - Auto-starts ngrok):**
```
Double-click: start.bat
```
This starts:
- ✅ Server on port 3000
- ✅ Ngrok tunnel to https://thrush-close-civet.ngrok-free.app

**macOS/Linux:**
```bash
bash start.sh
npm start
```

**Then open:**
- Local: http://localhost:3000
- Remote: https://thrush-close-civet.ngrok-free.app

---

## Accessing From Different Locations

### ✅ Remote Access (Current - Ngrok)
```
https://thrush-close-civet.ngrok-free.app
```
**Works from anywhere!** Automatic HTTPS included.

### Local Access (Same WiFi)
```
http://localhost:3000
```
Or from other devices:
```
http://192.168.1.X:3000
```
(Replace X with your PC's local IP - find with `ipconfig`)

---

## Common Tasks

### Change Server Port
Edit `.env`:
```
PORT=5000
```
Then restart: `npm start`

### Reset Everything (Start Fresh)
```bash
rm messages.db        # Delete database
npm install           # Reinstall dependencies
npm start             # Run fresh
```

### Backup Messages
```bash
# Windows
copy messages.db backup-$(date).db

# macOS/Linux
cp messages.db backup-$(date +%Y%m%d).db
```

### Update Node Dependencies
```bash
npm update
npm audit fix
```

### Delete Messages

**Single message:**
- Desktop: Right-click on message → Copy or Delete
- Mobile: Long-press (hold) on message → Copy or Delete
   - Only your sent messages can be deleted
   - Deletions sync instantly for both users

**Multiple messages:**
1. Click the **⋮** (three dots) button in chat header
2. Checkboxes appear next to your **sent** messages
3. Click checkboxes to select messages
4. Use toolbar options:
   - **Select All** - Mark all messages
   - **Delete** - Remove selected messages (with confirmation)
   - **Clear** - Unselect all messages
5. Selection counter shows how many are selected

### Monitor Server
While running, you'll see:
```
Connected to SQLite database
Database tables initialized
🔒 Private Messenger Server running on 3000
📍 Access at: http://localhost:3000
User connected: socket_id
```

### Check Database
```bash
# View all tables (requires SQLite too installed)
sqlite3 messages.db ".tables"

# Count messages
sqlite3 messages.db "SELECT COUNT(*) FROM messages;"

# View users
sqlite3 messages.db "SELECT * FROM users;"
```

---

## Troubleshooting

### "Port 3000 already in use"
```bash
# Windows - Kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### "Cannot find module 'express'"
```bash
npm install
```

### "Cannot GET /"
- Check server is running (should see logs)
- Try: http://localhost:3000/index.html
- Check console in browser (F12) for errors

### "Messages not sending"
- Open browser DevTools (F12)
- Check Console for JavaScript errors
- Look for WebSocket errors (red messages)
- Restart: npm start

### "Login fails"
- Clear browser cache: Ctrl+Shift+Delete
- Try different username
- Check console for errors
- Restart server

### Database Warnings
"database is locked" = Another tab has it open
- Close all other browser tabs/instances
- Restart server

---

## Security Reminders

✅ DO:
- Change JWT_SECRET before deploying
- Use strong passwords (12+ characters)
- Enable HTTPS when using port forwarding
- Back up messages.db regularly
- Keep Node.js updated

❌ DON'T:
- Share JWT_SECRET in code
- Use weak/simple passwords
- Leave server accessible without limits
- Ignore update notifications
- Use on untrusted networks without VPN

---

## Performance

**Server Requirements:**
- RAM: 128MB minimum (usual: <100MB)
- Disk: 1GB minimum
- CPU: Any modern processor OK

**Estimated Capacity:**
- Up to 50 users: Fine with standard setup
- 50-200 users: Consider beefier server
- 200+ users: Upgrade to PostgreSQL

**Local Phone Usage:**
- All traffic happens over WiFi
- No internet needed (if on same network)
- Very fast message delivery (<100ms)

---

## Port Forwarding Quick Setup

### Access Router
1. Open browser: `192.168.1.1`
2. Login (username/password on router label)
3. Find "Port Forwarding"

### Create Rule
| Setting | Value |
|---------|-------|
| External Port | 8000 |
| Internal IP | 192.168.1.50 (your PC's IP) |
| Internal Port | 3000 |
| Protocol | TCP |

### What to Tell Users
"Access at: http://[YOUR_PUBLIC_IP]:8000"

Find your public IP: https://whatismyipaddress.com

---

## Environment Variables (.env)

```
PORT=3000                    # Change server port
JWT_SECRET=mystrongsecret   # ⚠️ MUST change this!
NODE_ENV=production         # production or development
```

---

## File Structure

```
messenger-app/
├── server.js              # Main backend server
├── package.json           # Dependencies
├── .env                   # Configuration
├── messages.db            # Database (created on first run)
├── public/
│   ├── index.html         # Web interface
│   └── app.js             # Frontend JavaScript
├── README.md              # Full documentation
├── DEPLOYMENT.md          # Remote access guide
├── start.bat              # Windows launcher
└── start.sh               # Linux/macOS launcher
```

---

## Testing Checklist

Before sharing with friends:

- [ ] Locally: Can you send messages? (same WiFi)
- [ ] Login: Can you make accounts?
- [ ] Users: Can you see other users in sidebar?
- [ ] Real-time: Do messages appear instantly?
- [ ] History: After refresh, do old messages load?
- [ ] Remote: Works from outside home?
- [ ] Multiple: Can 2+ people use it simultaneously?

---

## Common Questions

**Q: Can I use this on my phone?**
A: Yes! Open http://192.168.1.X:3000 in browser (same WiFi)

**Q: Can I call/video call?**
A: Not yet - requires WebRTC setup. Text-only for now.

**Q: Can I send files/images?**
A: Not yet - text messages only. Future enhancement.

**Q: Why no notifications when the app is fully closed?**
A: The current notifications rely on an active WebSocket connection. When you swipe the app away, the connection closes. Full closed-app notifications require Web Push (future enhancement).

**Q: Is my data really private?**
A: Yes - stored only in messages.db on YOUR server

**Q: What if power goes out?**
A: Server goes offline. Users see "connection lost"

**Q: Can I migrate to PostgreSQL?**
A: Yes, but requires code updates. Stick with SQLite for up to 100 users.

---

## Getting Help

1. **Check server logs** - Run `npm start` and watch output
2. **Browser console** - Press F12, click Console tab
3. **Database** - Check if messages.db exists: `ls -la messages.db`
4. **Network** - Verify port forwarding works: Open http://YOUR_IP:8000

---

**That's it!** You now have a private, self-hosted messaging app. 🔒
