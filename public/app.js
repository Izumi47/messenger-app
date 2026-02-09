// Global state
let socket = null;
let currentUser = null;
let selectedUserId = null;
let token = null;

// Use the same origin as the page (handles http/https and ports automatically)
const API_URL = window.location.origin;

// ==================== THEME ====================

const THEME_STORAGE_KEY = 'theme';
const ACCESSIBILITY_STORAGE_KEY = 'accessibility';

function applyTheme(mode) {
  const isDark = mode === 'dark';
  document.body.classList.toggle('dark-mode', isDark);

  const toggleButtons = document.querySelectorAll('[data-theme-toggle], #themeToggleBtn');
  toggleButtons.forEach((toggleBtn) => {
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
    toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  });

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', isDark ? '#1f2430' : '#667eea');
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function toggleTheme() {
  const nextMode = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  localStorage.setItem(THEME_STORAGE_KEY, nextMode);
  applyTheme(nextMode);
}

// ==================== ACCESSIBILITY ====================

const defaultAccessibility = {
  textSize: 'medium',
  reduceMotion: false,
  highContrast: false,
  compactMode: false
};

function loadAccessibilitySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY));
    return { ...defaultAccessibility, ...(saved || {}) };
  } catch (err) {
    return { ...defaultAccessibility };
  }
}

function saveAccessibilitySettings(settings) {
  localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
}

function applyAccessibilitySettings(settings) {
  document.body.classList.remove('text-small', 'text-medium', 'text-large');
  document.body.classList.add(`text-${settings.textSize}`);

  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  document.body.classList.toggle('high-contrast', settings.highContrast);
  document.body.classList.toggle('compact-mode', settings.compactMode);

  const textSizeSelect = document.getElementById('textSizeSelect');
  if (textSizeSelect) {
    textSizeSelect.value = settings.textSize;
  }

  const reduceMotionToggle = document.getElementById('reduceMotionToggle');
  if (reduceMotionToggle) {
    reduceMotionToggle.checked = settings.reduceMotion;
  }

  const highContrastToggle = document.getElementById('highContrastToggle');
  if (highContrastToggle) {
    highContrastToggle.checked = settings.highContrast;
  }

  const compactModeToggle = document.getElementById('compactModeToggle');
  if (compactModeToggle) {
    compactModeToggle.checked = settings.compactMode;
  }
}

function initAccessibilityControls() {
  const settings = loadAccessibilitySettings();
  applyAccessibilitySettings(settings);

  const textSizeSelect = document.getElementById('textSizeSelect');
  if (textSizeSelect) {
    textSizeSelect.addEventListener('change', (event) => {
      settings.textSize = event.target.value;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
    });
  }

  const reduceMotionToggle = document.getElementById('reduceMotionToggle');
  if (reduceMotionToggle) {
    reduceMotionToggle.addEventListener('change', (event) => {
      settings.reduceMotion = event.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
    });
  }

  const highContrastToggle = document.getElementById('highContrastToggle');
  if (highContrastToggle) {
    highContrastToggle.addEventListener('change', (event) => {
      settings.highContrast = event.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
    });
  }

  const compactModeToggle = document.getElementById('compactModeToggle');
  if (compactModeToggle) {
    compactModeToggle.addEventListener('change', (event) => {
      settings.compactMode = event.target.checked;
      saveAccessibilitySettings(settings);
      applyAccessibilitySettings(settings);
    });
  }
}

// ==================== AUTH ====================

function toggleForms() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
  registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
}

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  if (!username || !password) {
    showError('regError', 'Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
      showError('regError', data.error || 'Registration failed');
      return;
    }

    showError('regError', '', 'success');
    document.getElementById('regUsername').value = '';
    document.getElementById('regPassword').value = '';
    
    // Auto-switch to login
    setTimeout(() => {
      toggleForms();
      document.getElementById('loginUsername').value = username;
      document.getElementById('loginPassword').focus();
    }, 1000);
  } catch (err) {
    showError('regError', 'Network error: ' + err.message);
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) {
    showError('loginError', 'Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
      showError('loginError', data.error || 'Login failed');
      return;
    }

    token = data.token;
    currentUser = data;

    // Request notification permission for PWA
    if (typeof window.requestNotificationPermission === 'function') {
      window.requestNotificationPermission();
    }

    // Initialize socket connection
    initializeSocket();

    // Hide auth screen and show app
    document.getElementById('authScreen').classList.add('hidden');

    // Load users
    await loadUsers();

    await subscribeToPushNotifications();
  } catch (err) {
    showError('loginError', 'Network error: ' + err.message);
  }
}

function logout() {
  if (socket) socket.disconnect();
  token = null;
  currentUser = null;
  selectedUserId = null;

  unsubscribeFromPushNotifications();
  
  // Clear saved credentials
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('usersList').innerHTML = '';
  document.getElementById('messages').innerHTML = '';
}

function showError(elementId, message, type = 'error') {
  const el = document.getElementById(elementId);
  if (type === 'success') {
    el.textContent = 'Registration successful!';
    el.style.color = '#27ae60';
  } else {
    el.textContent = message;
    el.style.color = '#e74c3c';
  }
}

// ==================== WEB PUSH ====================

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const keyResponse = await fetch(`${API_URL}/api/push/public-key`);
    const keyData = await keyResponse.json();
    const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  await fetch(`${API_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ subscription })
  });
}

async function unsubscribeFromPushNotifications() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  try {
    await fetch(`${API_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
  } catch (err) {
    console.warn('Push unsubscribe failed:', err.message);
  }

  await subscription.unsubscribe();
}

// ==================== SOCKET.IO ====================

function initializeSocket() {
  socket = io(API_URL, {
    auth: { token }
  });

  socket.emit('join', token);

  socket.on('new-message', (data) => {
    if (data.fromUserId === selectedUserId) {
      displayMessage(data.fromUsername, data.content, 'received');
    }
    
    // Send notification for new message (via Service Worker for better PWA support)
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      // Show notification if app is not focused or message is from a different conversation
      const shouldNotify = !document.hasFocus() || data.fromUserId !== selectedUserId;
      
      if (shouldNotify) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(`💬 ${data.fromUsername}`, {
            body: data.content.substring(0, 100),
            icon: '/icon-192.svg',
            badge: '/icon-192.svg',
            tag: `message-${data.fromUserId}`,
            vibrate: [200, 100, 200],
            requireInteraction: false,
            data: {
              userId: data.fromUserId,
              username: data.fromUsername,
              url: '/'
            },
            actions: [
              { action: 'open', title: 'Open' },
              { action: 'close', title: 'Close' }
            ]
          });
        });
      }
    }
  });

  socket.on('message-sent', (data) => {
    displayMessage('You', data.content, 'sent');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
}

// ==================== USERS ====================

async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const users = await response.json();
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    users.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      userItem.textContent = user.username;
      userItem.onclick = () => selectUser(user.id, user.username);
      usersList.appendChild(userItem);
    });
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

async function selectUser(userId, username) {
  selectedUserId = userId;

  // Update active state
  document.querySelectorAll('.user-item').forEach(el => {
    el.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update header
  document.getElementById('chatTitle').textContent = username;

  // Show input area
  document.getElementById('inputArea').style.display = 'flex';

  // Close sidebar on mobile after selecting user
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }

  // Load messages
  await loadMessages();
}

async function loadMessages() {
  try {
    const response = await fetch(`${API_URL}/api/messages/${selectedUserId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const messages = await response.json();
    const messagesEl = document.getElementById('messages');
    messagesEl.innerHTML = '';

    messages.forEach(msg => {
      const isSent = msg.from_user_id === currentUser.userId;
      displayMessage(
        isSent ? 'You' : 'Them',
        msg.content,
        isSent ? 'sent' : 'received',
        msg.created_at
      );
    });

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

// ==================== MESSAGING ====================

function displayMessage(sender, content, type = 'received', timestamp = null) {
  const messagesEl = document.getElementById('messages');
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.textContent = content;

  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.textContent = formatTime(timestamp);

  messageEl.appendChild(contentEl);
  messageEl.appendChild(timeEl);
  messagesEl.appendChild(messageEl);

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(timestamp) {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function sendMessage() {
  if (!selectedUserId) {
    alert('Please select a user first');
    return;
  }

  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content) return;

  // Emit via socket for real-time
  socket.emit('send-message', {
    toUserId: selectedUserId,
    content
  });

  // Clear input
  input.value = '';
}

// ==================== INITIALIZE ====================

// Check if already logged in (disabled - always show login screen)
// Uncomment below to enable auto-login if you want to stay logged in
window.addEventListener('load', () => {
  initAccessibilityControls();
  initTheme();
  document.querySelectorAll('[data-theme-toggle], #themeToggleBtn').forEach((button) => {
    button.addEventListener('click', toggleTheme);
  });

  const savedToken = localStorage.getItem('token');
  if (savedToken) {
    token = savedToken;
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    initializeSocket();
    document.getElementById('authScreen').classList.add('hidden');
    loadUsers().then(() => subscribeToPushNotifications());
  }
});

// Save token on successful login (disabled - not using auto-login)
function updateLocalStorage() {
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }
}

// Override login to save to localStorage
const originalLogin = login;
login = async function() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) {
    showError('loginError', 'Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (!response.ok) {
      showError('loginError', data.error || 'Login failed');
      return;
    }

    token = data.token;
    currentUser = data;
    updateLocalStorage(); // Save token for session persistence

    initializeSocket();
    document.getElementById('authScreen').classList.add('hidden');
    await loadUsers();
    await subscribeToPushNotifications();
  } catch (err) {
    showError('loginError', 'Network error: ' + err.message);
  }
};

// ==================== MOBILE SIDEBAR TOGGLE ====================

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (event) => {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  
  if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
    if (!sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
      sidebar.classList.remove('open');
    }
  }
});
