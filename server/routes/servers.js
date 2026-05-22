const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const servers = db.prepare(`
    SELECT s.* FROM servers s
    JOIN server_members sm ON s.id = sm.server_id
    WHERE sm.user_id = ?
    ORDER BY s.created_at DESC
  `).all(req.user.id);

  res.json(servers);
});

router.post('/', authenticate, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const serverId = uuidv4();
  const channelId = uuidv4();

  db.transaction(() => {
    db.prepare('INSERT INTO servers (id, name, owner_id) VALUES (?, ?, ?)').run(serverId, name, req.user.id);
    db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(serverId, req.user.id);
    db.prepare('INSERT INTO channels (id, server_id, name) VALUES (?, ?, ?)').run(channelId, serverId, 'general');
  })();

  res.status(201).json({ id: serverId, name, owner_id: req.user.id });
});

router.get('/:id', authenticate, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const isMember = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!isMember && server.owner_id !== req.user.id) return res.status(403).json({ error: 'Not a member' });

  res.json(server);
});

router.post('/:id/join', authenticate, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const existing = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) return res.status(409).json({ error: 'Already a member' });

  db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.get('/:id/members', authenticate, (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.status, sm.joined_at
    FROM server_members sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = ?
    ORDER BY sm.joined_at ASC
  `).all(req.params.id);

  res.json(members);
});

router.delete('/:id', authenticate, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner can delete' });
  }

  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
