const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');
const { db, initDb } = require('./db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const serverRoutes = require('./routes/servers');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Flick Zap Server', version: '1.0.0' });
});

const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  onlineUsers.set(socket.userId, socket.id);
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run('online', socket.userId);

  io.emit('user:online', { userId: socket.userId, status: 'online' });

  socket.on('message:send', (data) => {
    const { channelId, content } = data;
    const id = require('uuid').v4();

    db.prepare('INSERT INTO messages (id, channel_id, user_id, content) VALUES (?, ?, ?, ?)').run(id, channelId, socket.userId, content);

    const message = db.prepare(`
      SELECT m.*, u.username, u.avatar FROM messages m
      JOIN users u ON u.id = m.user_id WHERE m.id = ?
    `).get(id);

    io.emit('message:new', message);
  });

  socket.on('dm:send', (data) => {
    const { receiverId, content } = data;
    const id = require('uuid').v4();

    db.prepare('INSERT INTO direct_messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)').run(id, socket.userId, receiverId, content);

    const message = db.prepare(`
      SELECT dm.*, u.username, u.avatar FROM direct_messages dm
      JOIN users u ON u.id = dm.sender_id WHERE dm.id = ?
    `).get(id);

    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('dm:new', message);
    }
    socket.emit('dm:new', message);
  });

  socket.on('server:join', (serverId) => {
    socket.join(`server:${serverId}`);
  });

  socket.on('server:leave', (serverId) => {
    socket.leave(`server:${serverId}`);
  });

  socket.on('channel:join', (channelId) => {
    socket.join(`channel:${channelId}`);
  });

  socket.on('channel:leave', (channelId) => {
    socket.leave(`channel:${channelId}`);
  });

  socket.on('typing:start', (data) => {
    const { channelId } = data;
    socket.to(`channel:${channelId}`).emit('typing:update', {
      channelId,
      userId: socket.userId,
      username: socket.username,
      typing: true
    });
  });

  socket.on('typing:stop', (data) => {
    const { channelId } = data;
    socket.to(`channel:${channelId}`).emit('typing:update', {
      channelId,
      userId: socket.userId,
      typing: false
    });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);

    const stillConnected = [...onlineUsers.values()].some(sid => sid !== socket.id);
    if (!stillConnected) {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run('offline', socket.userId);
      io.emit('user:offline', { userId: socket.userId, status: 'offline' });
    }
  });
});

const PORT = process.env.PORT || 3000;
initDb().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Flick Zap Server running on port ${PORT}`);
  });
});
