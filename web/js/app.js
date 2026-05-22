let servers = [];
let channels = [];
let users = [];
let currentServerId = null;
let currentChannelId = null;
let currentDMUser = null;
let members = [];

async function loadApp() {
  await loadServers();
  await loadDMs();
}

async function loadServers() {
  try {
    servers = await apiRequest('/servers');
    renderServers();
  } catch (err) {
    console.error('Failed to load servers:', err);
  }
}

function renderServers() {
  const container = document.getElementById('server-list-items');
  container.innerHTML = '';

  servers.forEach(server => {
    const div = document.createElement('div');
    div.className = `server-item${server.id === currentServerId ? ' active' : ''}`;
    div.title = server.name;
    div.textContent = server.name.charAt(0).toUpperCase();
    div.onclick = () => selectServer(server.id);
    container.appendChild(div);
  });
}

async function selectServer(serverId) {
  currentServerId = serverId;
  currentDMUser = null;
  document.querySelectorAll('.server-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.server-item:nth-child(${servers.findIndex(s => s.id === serverId) + 3})`)?.classList.add('active');

  const server = servers.find(s => s.id === serverId);
  document.getElementById('current-server-name').textContent = server.name;

  try {
    channels = await apiRequest(`/channels/server/${serverId}`);
    members = await apiRequest(`/servers/${serverId}/members`);
    renderChannels();
    renderMembers();
    document.getElementById('dm-list').style.display = 'none';

    if (channels.length > 0) {
      selectChannel(channels[0].id);
    }
  } catch (err) {
    console.error('Failed to load channels:', err);
  }
}

function renderChannels() {
  const container = document.getElementById('channel-list');
  container.innerHTML = '<div class="channel-category"><span>Каналы</span></div>';

  channels.forEach(channel => {
    const div = document.createElement('div');
    div.className = `channel-item${channel.id === currentChannelId ? ' active' : ''}`;
    div.dataset.channelId = channel.id;
    div.innerHTML = `<i class="fas fa-hashtag"></i><span>${channel.name}</span>`;
    div.onclick = () => selectChannel(channel.id);
    container.appendChild(div);
  });
}

async function selectChannel(channelId) {
  currentChannelId = channelId;
  currentDMUser = null;
  document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.channel-item[data-channel-id="${channelId}"]`)?.classList.add('active');

  const channel = channels.find(c => c.id === channelId);
  if (channel) {
    document.getElementById('current-channel-name').textContent = `# ${channel.name}`;
  }

  document.getElementById('message-input-area').style.display = 'block';
  document.getElementById('sidebar-right').style.display = 'block';

  if (socket) {
    channels.forEach(c => socket.emit('channel:leave', c.id));
    socket.emit('channel:join', channelId);
  }

  try {
    const messages = await apiRequest(`/messages/channel/${channelId}`);
    renderMessages(messages);
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

async function loadDMs() {
  try {
    const friends = await apiRequest(`/users/${currentUser.id}/friends`);
    const dmContainer = document.getElementById('dm-list');
    dmContainer.style.display = 'block';
    dmContainer.innerHTML = '<div class="channel-category"><span>Личные сообщения</span></div>';

    const accepted = friends.filter(f => f.friendship_status === 'accepted');
    accepted.forEach(friend => {
      const div = document.createElement('div');
      div.className = 'dm-item';
      div.dataset.userId = friend.id;
      div.innerHTML = `
        <div class="dm-avatar">${friend.username.charAt(0).toUpperCase()}</div>
        <span>${friend.username}</span>
        <div class="status-dot status-${friend.status || 'offline'}"></div>
      `;
      div.onclick = () => openDM(friend);
      dmContainer.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load DMs:', err);
  }
}

async function openDM(friend) {
  currentDMUser = friend.id;
  currentChannelId = `dm_${friend.id}`;
  currentServerId = null;

  document.querySelectorAll('.server-item').forEach(el => el.classList.remove('active'));
  document.querySelector('.home-btn')?.classList.add('active');

  document.getElementById('current-server-name').textContent = 'Личные сообщения';
  document.getElementById('current-channel-name').textContent = `@ ${friend.username}`;
  document.getElementById('message-input-area').style.display = 'block';
  document.getElementById('sidebar-right').style.display = 'none';

  document.getElementById('dm-list').style.display = 'block';
  document.getElementById('channel-list').innerHTML = '<div class="channel-category"><span>Каналы</span></div>';

  try {
    const messages = await apiRequest(`/messages/dm/${friend.id}`);
    renderMessages(messages);
  } catch (err) {
    console.error('Failed to load DMs:', err);
  }
}

function renderMessages(messages) {
  const container = document.getElementById('messages-area');
  if (messages.length === 0) {
    container.innerHTML = '<div class="welcome-message"><p>Нет сообщений. Начните общение!</p></div>';
    return;
  }

  container.innerHTML = '';
  messages.forEach(msg => appendMessage(msg));
  container.scrollTop = container.scrollHeight;
}

function appendMessage(msg) {
  const container = document.getElementById('messages-area');

  const welcome = container.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = 'message';

  const initial = (msg.username || 'U').charAt(0).toUpperCase();
  const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <div class="message-avatar">${initial}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-username">${msg.username || 'Unknown'}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-text">${escapeHtml(msg.content)}</div>
    </div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderMembers() {
  const container = document.getElementById('members-list');
  container.innerHTML = '';

  members.forEach(member => {
    const div = document.createElement('div');
    div.className = 'member-item';
    div.dataset.userId = member.id;
    const initial = member.username.charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="member-avatar" style="background: linear-gradient(135deg, #4a7cff, #c084fc)">${initial}</div>
      <span>${member.username}</span>
      <div class="member-status status-${member.status || 'offline'}"></div>
    `;
    container.appendChild(div);
  });
}

function updateMemberStatus(userId, status) {
  const member = document.querySelector(`.member-item[data-user-id="${userId}"] .member-status`);
  if (member) {
    member.className = `member-status status-${status}`;
  }
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  try {
    if (currentDMUser) {
      await apiRequest('/messages/dm', {
        method: 'POST',
        body: JSON.stringify({ receiverId: currentDMUser, content })
      });
      if (socket) {
        socket.emit('dm:send', { receiverId: currentDMUser, content });
      }
    } else if (currentChannelId) {
      await apiRequest('/messages', {
        method: 'POST',
        body: JSON.stringify({ channelId: currentChannelId, content })
      });
      if (socket) {
        socket.emit('message:send', { channelId: currentChannelId, content });
      }
    }
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

function showHome() {
  currentServerId = null;
  currentChannelId = null;
  currentDMUser = null;
  document.querySelectorAll('.server-item').forEach(el => el.classList.remove('active'));
  document.querySelector('.home-btn')?.classList.add('active');
  document.getElementById('current-server-name').textContent = 'Главная';
  document.getElementById('current-channel-name').textContent = 'Добро пожаловать';
  document.getElementById('messages-area').innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon"><i class="fas fa-bolt"></i></div>
      <h2>Добро пожаловать в Flick Zap</h2>
      <p>Выберите канал или сервер чтобы начать общение</p>
    </div>
  `;
  document.getElementById('message-input-area').style.display = 'none';
  document.getElementById('sidebar-right').style.display = 'none';
}

function showCreateServer() {
  document.getElementById('create-server-modal').style.display = 'flex';
  document.getElementById('new-server-name').value = '';
}

async function createServer() {
  const name = document.getElementById('new-server-name').value.trim();
  if (!name) return;

  try {
    await apiRequest('/servers', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    closeModal();
    await loadServers();
  } catch (err) {
    alert(err.message);
  }
}

function showSearch() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
}

async function searchUsers(query) {
  if (query.length < 2) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

  try {
    const results = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`);
    const container = document.getElementById('search-results');
    container.innerHTML = '';

    results.forEach(user => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.innerHTML = `
        <div class="search-result-avatar">${user.username.charAt(0).toUpperCase()}</div>
        <div class="search-result-info">
          <div class="search-result-name">${user.username}</div>
          <div class="search-result-status">${user.status || 'offline'}</div>
        </div>
        <div class="search-result-actions">
          <button onclick="addFriend('${user.id}')">Добавить в друзья</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Search failed:', err);
  }
}

async function addFriend(userId) {
  try {
    await apiRequest('/users/friends/request', {
      method: 'POST',
      body: JSON.stringify({ friendId: userId })
    });
    closeModal();
    loadDMs();
  } catch (err) {
    alert(err.message);
  }
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
