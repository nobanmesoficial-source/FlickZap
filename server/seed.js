const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, initDb, saveDb } = require('./db');

async function seed() {
  await initDb();

  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (existing) {
    console.log('Admin user already exists');
    return;
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync('admin123', 10);

  db.prepare('INSERT INTO users (id, username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, 'admin', 'admin@flickzap.local', hash, 'admin', 'offline'
  );

  console.log('Admin user created:');
  console.log('  Email: admin@flickzap.local');
  console.log('  Password: admin123');
}

seed().catch(console.error);
