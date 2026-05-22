const express = require('express');
const { db } = require('../db');

const router = express.Router();

function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.get('/users', (req, res) => {
  const auth = require('../middleware/auth');
  const jwt = require('jsonwebtoken');
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], auth.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const users = db.prepare('SELECT id, username, email, avatar, status, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.delete('/users/:id', (req, res) => {
  const auth = require('../middleware/auth');
  const jwt = require('jsonwebtoken');
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], auth.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.put('/users/:id/role', (req, res) => {
  const auth = require('../middleware/auth');
  const jwt = require('jsonwebtoken');
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], auth.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ success: true, role });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/stats', (req, res) => {
  const auth = require('../middleware/auth');
  const jwt = require('jsonwebtoken');
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], auth.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const serverCount = db.prepare('SELECT COUNT(*) as count FROM servers').get().count;
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const onlineCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'online'").get().count;

    res.json({ users: userCount, servers: serverCount, messages: messageCount, online: onlineCount });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
