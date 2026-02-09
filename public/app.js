// Global state
let socket = null;
let currentUser = null;
let selectedUserId = null;
let token = null;
let selectionMode = false;
let selectedMessages = new Set();

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
        msg.created_at,
        msg.id,
        isSent
      );
    });

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (err) {
    console.error('Error loading messages:', err);
  }
}

// ==================== MESSAGING ====================

function displayMessage(sender, content, type = 'received', timestamp = null, messageId = null, canDelete = false) {
  const messagesEl = document.getElementById('messages');
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  if (messageId) {
    messageEl.setAttribute('data-message-id', messageId);
  }

  // Checkbox for selection mode
  const checkbox = document.createElement('div');
  checkbox.className = 'message-checkbox';
  if (selectionMode) {
    checkbox.classList.add('visible');
  }
  checkbox.onclick = (e) => {
    e.stopPropagation();
    toggleMessageSelection(messageId, messageEl, checkbox);
  };

  // Wrapper for content
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper';

  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.textContent = content;

  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.textContent = formatTime(timestamp);

  wrapper.appendChild(contentEl);
  wrapper.appendChild(timeEl);

  messageEl.appendChild(checkbox);
  messageEl.appendChild(wrapper);

  // Add long-press context menu for sent messages
  if (canDelete && messageId) {
    addMessageContextMenu(contentEl, content, messageId, messageEl);
  }

  messagesEl.appendChild(messageEl);

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addMessageContextMenu(contentEl, messageContent, messageId, messageEl) {
  let longPressTimer = null;
  let startX, startY;

  function showContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    // Close any existing context menu
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'message-context-menu';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(messageContent).then(() => {
        closeContextMenu();
      });
    };

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete';
    deleteBtn.onclick = () => {
      closeContextMenu();
      deleteMessage(messageId, messageEl);
    };

    menu.appendChild(copyBtn);
    menu.appendChild(deleteBtn);

    // Position menu at cursor or touch point
    let x = e.clientX || e.touches?.[0].clientX || 0;
    let y = e.clientY || e.touches?.[0].clientY || 0;

    document.body.appendChild(menu);
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 10) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 10) + 'px';

    menu.id = 'activeContextMenu';
  }

  // Long press for touch
  contentEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    longPressTimer = setTimeout(() => {
      showContextMenu(e.touches[0]);
    }, 500);
  });

  contentEl.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
  });

  contentEl.addEventListener('touchmove', (e) => {
    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;
    if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
      clearTimeout(longPressTimer);
    }
  });

  // Right click context menu for desktop
  contentEl.addEventListener('contextmenu', showContextMenu);
}

function closeContextMenu() {
  const existingMenu = document.getElementById('activeContextMenu');
  if (existingMenu) {
    existingMenu.remove();
  }
}

async function deleteMessage(messageId, messageEl) {
  try {
    const response = await fetch(`${API_URL}/api/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to delete message');
    }

    // Fade out and remove
    messageEl.classList.add('deleting');
    setTimeout(() => {
      messageEl.remove();
    }, 300);
  } catch (err) {
    console.error('Error deleting message:', err);
    alert('Error deleting message');
  }
}

// Close context menu when clicking elsewhere
document.addEventListener('click', closeContextMenu);
document.addEventListener('contextmenu', (e) => {
  const menu = document.getElementById('activeContextMenu');
  if (menu && !menu.contains(e.target)) {
    closeContextMenu();
  }
});

// ==================== MESSAGE SELECTION ====================

function toggleSelectionMode() {
  selectionMode = !selectionMode;
  selectedMessages.clear();
  updateSelectionMode();
}

function updateSelectionMode() {
  const toolbar = document.getElementById('selectionToolbar');
  const modeBtn = document.getElementById('selectionModeBtn');
  const checkboxes = document.querySelectorAll('.message-checkbox');
  
  toolbar.classList.toggle('active', selectionMode);
  modeBtn.style.color = selectionMode ? '#ff6b6b' : '#667eea';
  
  checkboxes.forEach(cb => {
    cb.classList.toggle('visible', selectionMode);
  });
  
  updateSelectionCount();
}

function toggleMessageSelection(messageId, messageEl, checkbox) {
  if (selectedMessages.has(messageId)) {
    selectedMessages.delete(messageId);
    checkbox.classList.remove('checked');
    messageEl.classList.remove('selected');
  } else {
    selectedMessages.add(messageId);
    checkbox.classList.add('checked');
    messageEl.classList.add('selected');
  }
  updateSelectionCount();
}

function selectAllMessages() {
  const messages = document.querySelectorAll('.message');
  selectedMessages.clear();
  
  messages.forEach(msgEl => {
    const msgId = msgEl.getAttribute('data-message-id');
    const checkbox = msgEl.querySelector('.message-checkbox');
    
    if (msgId && checkbox.classList.contains('visible')) {
      selectedMessages.add(msgId);
      checkbox.classList.add('checked');
      msgEl.classList.add('selected');
    }
  });
  
  updateSelectionCount();
}

function clearSelection() {
  const messages = document.querySelectorAll('.message');
  
  messages.forEach(msgEl => {
    const checkbox = msgEl.querySelector('.message-checkbox');
    checkbox.classList.remove('checked');
    msgEl.classList.remove('selected');
  });
  
  selectedMessages.clear();
  updateSelectionCount();
}

function updateSelectionCount() {
  const countEl = document.getElementById('selectionCount');
  countEl.textContent = `${selectedMessages.size} selected`;
}

async function deleteSelectedMessages() {
  if (selectedMessages.size === 0) return;
  
  const count = selectedMessages.size;
  if (!confirm(`Delete ${count} message${count > 1 ? 's' : ''}?`)) return;
  
  try {
    const deletePromises = Array.from(selectedMessages).map(msgId => 
      fetch(`${API_URL}/api/messages/${msgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
    );
    
    const results = await Promise.all(deletePromises);
    const allSuccess = results.every(r => r.ok);
    
    if (allSuccess) {
      // Remove messages from DOM
      const messages = document.querySelectorAll('.message');
      messages.forEach(msgEl => {
        const msgId = msgEl.getAttribute('data-message-id');
        if (selectedMessages.has(msgId)) {
          msgEl.classList.add('deleting');
          setTimeout(() => msgEl.remove(), 300);
        }
      });
      
      selectedMessages.clear();
      updateSelectionCount();
    } else {
      throw new Error('Some messages failed to delete');
    }
  } catch (err) {
    console.error('Error deleting messages:', err);
    alert('Error deleting messages');
  }
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

  // Display message immediately with placeholder ID (will be replaced when we get the real one via socket)
  displayMessage('You', content, 'sent', null, null, true);

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
