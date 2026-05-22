const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/search', authenticate, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const users = db.prepare(
    'SELECT id, username, avatar, status FROM users WHERE username LIKE ? AND id != ? LIMIT 20'
  ).all(`%${q}%`, req.user.id);

  res.json(users);
});

router.get('/:id', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, email, avatar, status, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.put('/status', authenticate, (req, res) => {
  const { status } = req.body;
  const allowed = ['online', 'idle', 'dnd', 'offline'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.user.id);
  res.json({ status });
});

router.get('/:id/friends', authenticate, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.status, f.status as friendship_status, f.id as friendship_id
    FROM friendships f
    JOIN users u ON (u.id = f.friend_id OR u.id = f.user_id)
    WHERE (f.user_id = ? OR f.friend_id = ?) AND u.id != ?
    ORDER BY f.created_at DESC
  `).all(req.params.id, req.params.id, req.params.id);

  res.json(friends);
});

router.post('/friends/request', authenticate, (req, res) => {
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ error: 'friendId required' });
  if (friendId === req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });

  const existing = db.prepare(
    'SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
  ).get(req.user.id, friendId, friendId, req.user.id);

  if (existing) return res.status(409).json({ error: 'Friendship already exists' });

  const id = uuidv4();
  db.prepare('INSERT INTO friendships (id, user_id, friend_id) VALUES (?, ?, ?)').run(id, req.user.id, friendId);
  res.status(201).json({ id, status: 'pending' });
});

router.put('/friends/:id/accept', authenticate, (req, res) => {
  const friendship = db.prepare('SELECT * FROM friendships WHERE id = ?').get(req.params.id);
  if (!friendship) return res.status(404).json({ error: 'Friendship not found' });
  if (friendship.friend_id !== req.user.id) return res.status(403).json({ error: 'Not your request' });

  db.prepare('UPDATE friendships SET status = ? WHERE id = ?').run('accepted', req.params.id);
  res.json({ status: 'accepted' });
});

router.delete('/friends/:id', authenticate, (req, res) => {
  const friendship = db.prepare('SELECT * FROM friendships WHERE id = ?').get(req.params.id);
  if (!friendship) return res.status(404).json({ error: 'Friendship not found' });
  if (friendship.user_id !== req.user.id && friendship.friend_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your friendship' });
  }

  db.prepare('DELETE FROM friendships WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
