# 🔒 Security Guide - Private Messenger

## Overview

This document outlines the security features and best practices for deploying and using the Private Messenger application.

---

## ✅ Security Features Implemented

### 1. Authentication & Password Security
- **Bcryptjs Hashing** - All passwords are hashed with bcryptjs (10 salt rounds)
- **JWT Tokens** - Secure token-based authentication with 7-day expiration
- **Token Expiration** - Tokens automatically expire, requiring re-login
- **Secure Token Verification** - Every API endpoint validates tokens before processing

### 2. Database Security
- **Parameterized Queries** - All SQL uses placeholders to prevent SQL injection
- **No String Concatenation** - User input is never directly concatenated into SQL
- **Message Authorization** - Users can only delete their own messages

### 3. Frontend Security
- **XSS Protection** - Uses `textContent` instead of `innerHTML` for user data
- **No Dangerous Functions** - No `eval()`, `exec()`, or similar dangerous functions
- **Input Sanitization** - User input is validated and sanitized

### 4. API Security
- **CORS Restrictions** - Only configured origins can access the API
- **Rate Limiting** - Protects against brute force and DoS attacks
  - Authentication endpoints: 5 attempts per 15 minutes
  - General API: 100 requests per minute
- **Input Validation** - All user inputs are validated for format and length
  - Username: 3-30 characters, alphanumeric + underscore/hyphen only
  - Password: 8-128 characters
  - Messages: Up to 1MB payload limit

### 5. HTTP Security Headers
- **HSTS** (HTTP Strict Transport Security) - Forces HTTPS in production
- **CSP** (Content Security Policy) - Prevents script injection and XSS
- **X-Content-Type-Options** - Prevents MIME-type sniffing
- **X-Frame-Options** - Prevents clickjacking attacks
- **X-XSS-Protection** - Enables browser XSS protection
- **Referrer-Policy** - Controls referrer information

### 6. WebSocket Security
- **Socket.io Authentication** - Validates JWT tokens on connection
- **CORS-Protected WebSockets** - Only configured origins can establish WebSocket connections
- **User Room Isolation** - Users only receive messages for their own room

### 7. Web Push Security
- **VAPID Keys** - Auto-generated and stored securely (not in version control)
- **Subscription Validation** - Validates push subscription payloads
- **Endpoint Cleanup** - Removes invalid/expired push endpoints automatically

---

## 🔧 Configuration

### Required: Set JWT_SECRET

**CRITICAL:** Change the JWT_SECRET to a random value:

```bash
# Generate a secure key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy the output and update .env
JWT_SECRET=<paste-output-here>
```

### Optional: Configure CORS Origins

Add your domain to `ALLOWED_ORIGINS` in `server.js` if using a custom domain:

```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://your-domain.com',
  'https://your-subdomain.ngrok-free.app'
];
```

Or set `NGROK_URL` in `.env`:
```env
NGROK_URL=https://YOUR_NGROK_DOMAIN.ngrok-free.app
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] **Change JWT_SECRET** - Use a cryptographically secure random value (32+ characters)
- [ ] **Set NODE_ENV=production** - Enables security headers like HSTS
- [ ] **Update ALLOWED_ORIGINS** - Restrict to your actual domain(s)
- [ ] **Use HTTPS** - Only deploy with HTTPS (ngrok provides this automatically)
- [ ] **Secure Database** - Regular backups and restricted file permissions
- [ ] **Monitor Logs** - Watch for suspicious activity and failed authentication attempts
- [ ] **Keep Dependencies Updated** - Run `npm audit fix` regularly
- [ ] **Firewall Rules** - Configure firewall to restrict port access if needed
- [ ] **Disable Debug Logging** - Review console.log statements before production

---

## 📋 Accessing the Application

### Local Development
```
http://localhost:3000
```

### Remote Access (Ngrok)
```
https://YOUR_NGROK_DOMAIN.ngrok-free.app
```

### Same Network
```
http://192.168.X.X:3000
```
(Replace X with your server's local IP)

---

## 🛡️ Protecting User Privacy

### Data at Rest
- All messages stored in local SQLite database
- Database file: `messages.db` (not committed to git)
- Backup regularly to secure location

### Data in Transit
- HTTPS encryption via ngrok (automatic)
- WebSocket connections secured with `wss://` (secure WebSocket)
- All tokens transmitted in `Authorization` header

### User Privacy Practices
- **No analytics** - No tracking or metrics sent to third parties
- **No logs of message content** - Only timestamps and user IDs are logged
- **No user data sharing** - All data stays on your server
- **Message retention** - Messages stored indefinitely unless manually deleted

---

## ⚠️ Known Limitations

1. **Closed App Push Notifications** - Require Web Push API (future enhancement)
2. **Message Encryption** - Messages stored in plaintext (recommend database encryption)
3. **No Message Deletion for Recipients** - Only sender can delete messages
4. **No E2E Encryption** - Messages transmitted unencrypted (HTTPS encrypts in transit)

---

## 🔍 Security Monitoring

### Log Files to Monitor
- `npm start` console output
- Failed authentication attempts
- Rate limit violations
- WebSocket connection errors

### Commands to Check Security
```bash
# Check dependencies for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# View database (if SQLite installed)
sqlite3 messages.db "SELECT username, created_at FROM users;"

# Count messages
sqlite3 messages.db "SELECT COUNT(*) FROM messages;"
```

---

## 📧 Bug Reports

If you find a security vulnerability:
1. **Do NOT** create a public issue
2. Document the issue privately
3. Include steps to reproduce
4. Provide suggestions for fixes

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Security](https://tools.ietf.org/html/rfc7519)

---

## Version History

- **v1.0** - Initial security implementation with rate limiting, CORS restrictions, input validation, and security headers
