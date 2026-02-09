# 🔒 Private Messenger - Deployment & Remote Access Guide

This guide covers setting up your messenger app for remote access while maintaining complete data privacy.

## ✅ Current Setup: Ngrok (Active & Recommended)

**You're already configured with ngrok!**

- **Remote URL:** `https://thrush-close-civet.ngrok-free.app`
- **Local URL:** `http://localhost:3000`
- **Auto-start:** Run `start.bat` (Windows) - automatically starts server + ngrok
- **Manual start:** See "Method 4: Ngrok" below

**Advantages:**
- ✅ No port forwarding needed
- ✅ Automatic HTTPS (secure)
- ✅ Works behind any firewall/router
- ✅ Stable custom domain
- ✅ Easy setup (one command)

**To use:** Just run `start.bat` and share `https://thrush-close-civet.ngrok-free.app` with anyone!

---

## Alternative Deployment Methods

The following methods are alternatives if you don't want to use ngrok:

## Quick Start

1. **Run Server**: `npm start` or `./start.bat` (Windows) / `./start.sh` (macOS/Linux)
2. **Access Locally**: `http://localhost:3000`
3. **Create Account**: Register username & password
4. **Follow below** for remote access

---

## Architecture Overview

```
                     INTERNET
                         │
        ┌────────────────┼────────────────┐
        │                                  │
    [User 1]                          [User 2]
   Remote PC                         Remote Phone
        │                                  │
        │        Port Forwarding          │
        │        (Router Config)          │
        │                                  │
        └────────────────┬────────────────┘
                         │
                    [Router]
                    Port 8000 → 3000
                         │
     ┌───────────────────┼───────────────────┐
     │                                       │
  [Your Home Network]                        
     │
 [Your PC/Server]
 Port 3000
 messager-app
```

---

## Method 1: Port Forwarding (Recommended for Home Setup)

### Step 1: Find Your Local IP

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your network adapter (e.g., `192.168.1.50`)

**macOS/Linux:**
```bash
ifconfig
```
Look for `inet` address (e.g., `192.168.1.50`)

### Step 2: Access Router Settings

1. Open browser and go to: `192.168.1.1` or `192.168.0.1`
2. Login (default username: `admin`, password: `admin` or check router label)
3. Find "Port Forwarding" section (usually under Advanced or NAT settings)

### Step 3: Configure Port Forwarding

Create a new forwarding rule:
- **External Port**: `8000` (users will access this)
- **Internal IP**: Your local IP (e.g., `192.168.1.50`)
- **Internal Port**: `3000`
- **Protocol**: TCP

**Example routers:**
- TP-Link: Advanced → NAT → Port Forwarding
- Netgear: Advanced → Port Forwarding
- ASUS: Network Tools → Port Forwarding
- D-Link: Advanced → Virtual Server

### Step 4: Find Your Public IP

1. Visit: https://whatismyipaddress.com
2. Note your IPv4 address (e.g., `203.0.113.45`)

### Step 5: Test Remote Access

**From outside your home WiFi:**
- Desktop: `http://203.0.113.45:8000`
- Mobile: Same URL above

**From home WiFi:**
- Use local IP: `http://192.168.1.50:3000`
- Or use public IP: `http://203.0.113.45:8000` (may not work due to hairpin NAT)

---

## Method 2: Dynamic DNS (More User-Friendly)

### Problem
Your home IP changes regularly (every few days). Dynamic DNS solves this.

### Solution: DuckDNS (Free)

#### Step 1: Get Free Domain

1. Visit: https://www.duckdns.org
2. Sign up with email
3. Create domain: `mymessenger` → `mymessenger.duckdns.org`
4. You'll get a **token** (save it!)

#### Step 2: Set Up Dynamic IP Update

**Windows - Automatic Updates:**

Create `update-dns.ps1`:
```powershell
# Update DuckDNS IP every 30 minutes
$token = "YOUR_TOKEN_HERE"
$domain = "mymessenger"

while ($true) {
    Invoke-WebRequest "https://www.duckdns.org/update?domains=$domain&token=$token&ip=" | Out-Null
    Write-Host "Updated DuckDNS at $(Get-Date)"
    Start-Sleep -Seconds 1800  # Every 30 minutes
}
```

Run in PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
powershell -ExecutionPolicy Bypass -File update-dns.ps1
```

**macOS/Linux - Cron Job:**

```bash
# Edit crontab
crontab -e

# Add this line (updates every 30 minutes)
*/30 * * * * curl "https://www.duckdns.org/update?domains=mymessenger&token=YOUR_TOKEN_HERE&ip="
```

#### Step 3: Port Forwarding (Same as Method 1)

Configure router to forward port 8000 to 3000

#### Step 4: Access Via Domain

- **Remote**: `http://mymessenger.duckdns.org:8000`
- **Local**: `http://192.168.1.50:3000`

**Advantages:**
- ✅ Stable address (domain doesn't change)
- ✅ Users don't need to know your IP
- ✅ Free
- ✅ Easy to remember

---

## Method 3: VPN-Based (Most Secure)

### Concept
Users connect to your VPN → access messenger via local IP

### Setup WireGuard VPN

#### Step 1: Install WireGuard on Server

**Windows:**
- Download: https://www.wireguard.com/install/

**Linux/Raspberry Pi:**
```bash
sudo apt install wireguard wireguard-tools
```

#### Step 2: Generate Keys

```bash
wg genkey | tee privatekey | wg pubkey > publickey
```

Save both keys.

#### Step 3: Create VPN Config

Create `/etc/wireguard/wg0.conf`:
```ini
[Interface]
PrivateKey = YOUR_PRIVATE_KEY
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = CLIENT_PUBLIC_KEY
AllowedIPs = 10.0.0.2/32
```

#### Step 4: Start VPN

```bash
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

#### Step 5: Share VPN Config with Users

Share client configuration with peers. Once connected to VPN, they access:
```
http://10.0.0.1:3000
```

**Advantages:**
- ✅ Highly secure
- ✅ No direct port exposure
- ✅ Only authorized users can connect
- ✅ Encrypts all traffic
- ❌ More complex setup
- ❌ Users must install VPN client

---

## Method 4: Ngrok (✅ Current Setup - Active)

### Overview
**This is your current active deployment method!**

Ngrok creates a secure tunnel from the internet to your local server without requiring port forwarding.

### Advantages
- ✅ No port forwarding needed
- ✅ Automatic HTTPS
- ✅ Works behind any firewall/NAT
- ✅ Custom domain support (you have: `thrush-close-civet.ngrok-free.app`)
- ✅ Easy setup
- ✅ Built-in dashboard for monitoring

### Step 1: Install Ngrok

Download from: https://ngrok.com/download

**Windows:**
```bash
choco install ngrok  # With Chocolatey
```

Or download the executable and add to PATH.

### Step 2: Authenticate

Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Step 3: Start Your Server

```bash
npm start
```

Server runs on `localhost:3000`

### Step 4: Start Ngrok Tunnel

**With your custom domain:**
```bash
ngrok http --domain=thrush-close-civet.ngrok-free.app 3000
```

**Or use auto-start:**
```bash
start.bat  # Windows - automatically starts both server and ngrok
```

### Step 5: Access Your App

- **Local:** `http://localhost:3000`
- **Remote:** `https://thrush-close-civet.ngrok-free.app`

Share the remote URL with anyone!

### Keep It Running 24/7

**Option 1: Use start.bat**
Just keep the terminal windows open

**Option 2: Use PM2 for server**
```bash
npm install -g pm2
pm2 start server.js --name messenger
pm2 startup
pm2 save
```

Then run ngrok separately in another terminal.

**Option 3: Windows Service (NSSM)**
Convert ngrok to a Windows service:
1. Download NSSM: https://nssm.cc/download
2. Install as service:
```bash
nssm install ngrok
# Path: C:\path\to\ngrok.exe
# Arguments: http --domain=thrush-close-civet.ngrok-free.app 3000
```

### Ngrok Dashboard

View all requests at: https://dashboard.ngrok.com

### Free Tier Limitations

- Custom domain: ✅ Included (you have this)
- HTTPS: ✅ Included
- Connection timeout: 2 hours on free tier
- Need to upgrade for 24/7 permanent connections

---

## Method 5: Cloudflare Tunnel (Alternative - No Port Forwarding!)

### Advantage
No port forwarding needed, no IP exposure

### Step 1: Install Cloudflare Tunnel

```bash
npm install -g @cloudflare/wrangler
```

### Step 2: Authenticate

```bash
wrangler tunnel login
```

### Step 3: Create Tunnel

```bash
wrangler tunnel create mymessenger
```

### Step 4: Configure YAML

Create `wrangler.toml`:
```toml
name = "mymessenger"

[[env.production.services]]
service = "http://localhost:3000"
```

### Step 5: Start Tunnel

```bash
wrangler tunnel run mymessenger
```

### Step 6: Access Via Cloudflare URL

`https://mymessenger.YOUR_DOMAIN.workers.dev`

**Advantages:**
- ✅ No port forwarding needed
- ✅ Automatic HTTPS
- ✅ Super easy setup
- ⚠️ Data technically passes through Cloudflare (defeats "no third party"?)

**Note**: This uses Cloudflare as a relay, so if privacy from all third parties is critical, choose VPN method instead.

---

## HTTPS/TLS Setup (Important for Security)

### Using Let's Encrypt (Free)

#### Install Certbot

```bash
npm install -g certbot
```

#### Generate Certificate

```bash
sudo certbot certonly --standalone -d mymessenger.duckdns.org
```

#### Update Server

Edit `server.js` to use HTTPS:

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/mymessenger.duckdns.org/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/mymessenger.duckdns.org/fullchain.pem')
};

https.createServer(options, app).listen(PORT);
```

#### Auto-Renewal

```bash
sudo certbot renew --dry-run  # Test
sudo certbot renew            # Renew
```

---

## Security Checklist

- [ ] Changed JWT_SECRET in `.env`
- [ ] Set strong passwords for all users
- [ ] Enabled HTTPS/TLS
- [ ] Configured firewall (only allow port 8000/3000)
- [ ] Set up automatic DuckDNS updates
- [ ] Backed up `messages.db`
- [ ] Updated Node.js and dependencies
- [ ] Used VPN for maximum privacy

---

## Troubleshooting

### "Connection Refused" from Remote
- [ ] Server running? Check: `npm start`
- [ ] Port forwarding enabled on router? Check router admin panel
- [ ] Correct public IP? Visit: whatismyipaddress.com
- [ ] Firewall blocking? Check Windows Defender or antivirus

### "Connection Reset" from Remote
- [ ] Check server logs: `npm start`
- [ ] Restart server
- [ ] Verify port forwarding: external 8000 → internal 192.168.X.X:3000

### Domain Not Resolving
- [ ] DuckDNS IP updated? Go to duckdns.org and check
- [ ] Run DNS update script manually: `curl https://www.duckdns.org/update?domains=mymessenger&token=YOUR_TOKEN&ip=`

### Slow Connection from Remote
- [ ] Upload speed OK? Test at: speedtest.net
- [ ] Server CPU/RAM OK? Monitor with `top` or Task Manager
- [ ] Too many messages? Archive old messages in database

---

## Performance Tips

- Keep server run 24/7 for best reliability
- Monitor bandwidth usage (messages stored locally = not much)
- Add rate limiting to prevent spam
- Regular database optimization: `VACUUM messages.db`

---

## Next Steps

1. **Test locally first** - Both users on same WiFi
2. **Enable port forwarding** - Test from mobile hotspot
3. **Set up DuckDNS** - For permanent access
4. **Enable HTTPS** - Encrypt traffic
5. **Regular backups** - Don't lose messages
6. **Share domain** with trusted users: `mymessenger.duckdns.org:8000`

---

**You now have a completely private, self-hosted messenger!** 🔒
