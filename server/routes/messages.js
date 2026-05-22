const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/channel/:channelId', authenticate, (req, res) => {
  const { before } = req.query;
  let messages;

  const query = `
    SELECT m.*, u.username, u.avatar
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = ?
  `;

  if (before) {
    messages = db.prepare(`${query} AND m.created_at < (SELECT created_at FROM messages WHERE id = ?) ORDER BY m.created_at DESC LIMIT 50`).all(req.params.channelId, before);
  } else {
    messages = db.prepare(`${query} ORDER BY m.created_at DESC LIMIT 50`).all(req.params.channelId);
  }

  res.json(messages.reverse());
});

router.post('/', authenticate, (req, res) => {
  const { channelId, content } = req.body;
  if (!channelId || !content) return res.status(400).json({ error: 'channelId and content required' });

  const id = uuidv4();
  db.prepare('INSERT INTO messages (id, channel_id, user_id, content) VALUES (?, ?, ?, ?)').run(id, channelId, req.user.id, content);

  const message = db.prepare('SELECT m.*, u.username, u.avatar FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?').get(id);
  res.status(201).json(message);
});

router.delete('/:id', authenticate, (req, res) => {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot delete this message' });
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/dm/:userId', authenticate, (req, res) => {
  const messages = db.prepare(`
    SELECT dm.*, u.username, u.avatar
    FROM direct_messages dm
    JOIN users u ON u.id = dm.sender_id
    WHERE (dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?)
    ORDER BY dm.created_at ASC LIMIT 50
  `).all(req.user.id, req.params.userId, req.params.userId, req.user.id);

  res.json(messages);
});

router.post('/dm', authenticate, (req, res) => {
  const { receiverId, content } = req.body;
  if (!receiverId || !content) return res.status(400).json({ error: 'receiverId and content required' });

  const id = uuidv4();
  db.prepare('INSERT INTO direct_messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)').run(id, req.user.id, receiverId, content);

  const message = db.prepare('SELECT dm.*, u.username, u.avatar FROM direct_messages dm JOIN users u ON u.id = dm.sender_id WHERE dm.id = ?').get(id);
  res.status(201).json(message);
});

module.exports = router;
