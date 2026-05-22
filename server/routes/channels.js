const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/server/:serverId', authenticate, (req, res) => {
  const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY created_at ASC').all(req.params.serverId);
  res.json(channels);
});

router.post('/', authenticate, (req, res) => {
  const { serverId, name } = req.body;
  if (!serverId || !name) return res.status(400).json({ error: 'serverId and name required' });

  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  if (server.owner_id !== req.user.id) return res.status(403).json({ error: 'Only owner can create channels' });

  const id = uuidv4();
  db.prepare('INSERT INTO channels (id, server_id, name) VALUES (?, ?, ?)').run(id, serverId, name);
  res.status(201).json({ id, server_id: serverId, name });
});

router.put('/:id', authenticate, (req, res) => {
  const channel = db.prepare('SELECT c.*, s.owner_id FROM channels c JOIN servers s ON s.id = c.server_id WHERE c.id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.user.id) return res.status(403).json({ error: 'Only server owner can edit channels' });

  const { name } = req.body;
  db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ id: req.params.id, name });
});

router.delete('/:id', authenticate, (req, res) => {
  const channel = db.prepare('SELECT c.*, s.owner_id FROM channels c JOIN servers s ON s.id = c.server_id WHERE c.id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (channel.owner_id !== req.user.id) return res.status(403).json({ error: 'Only server owner can delete channels' });

  db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
