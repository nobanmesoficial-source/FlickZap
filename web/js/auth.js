let currentUser = null;
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (token) {
    apiRequest('/auth/me').then(user => {
      currentUser = user;
      connectSocket();
      document.getElementById('auth-page').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadApp();
    }).catch(() => {
      clearToken();
    });
  }

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
      document.getElementById('login-error').textContent = '';
      document.getElementById('reg-error').textContent = '';
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setToken(data.token);
      currentUser = data.user;
      connectSocket();
      document.getElementById('auth-page').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadApp();
    } catch (err) {
      document.getElementById('login-error').textContent = err.message;
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      setToken(data.token);
      currentUser = data.user;
      connectSocket();
      document.getElementById('auth-page').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadApp();
    } catch (err) {
      document.getElementById('reg-error').textContent = err.message;
    }
  });

  document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
});

function connectSocket() {
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth: { token: getToken() }
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('message:new', (message) => {
    if (message.channel_id === currentChannelId) {
      appendMessage(message);
    }
  });

  socket.on('dm:new', (message) => {
    const inDM = currentChannelId && currentChannelId.startsWith('dm_');
    if (inDM && (message.sender_id === currentDMUser || message.receiver_id === currentDMUser)) {
      appendMessage(message);
    }
  });

  socket.on('typing:update', (data) => {
    const indicator = document.getElementById('typing-indicator');
    if (data.typing && data.channelId === currentChannelId) {
      indicator.textContent = `${data.username} печатает...`;
    } else {
      indicator.textContent = '';
    }
  });

  socket.on('user:online', (data) => {
    updateMemberStatus(data.userId, 'online');
  });

  socket.on('user:offline', (data) => {
    updateMemberStatus(data.userId, 'offline');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}
