const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'flickzap.db');
let _db = null;

function saveDb() {
  if (_db) {
    const data = _db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    _db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    _db = new SQL.Database();
  }

  _db.run('PRAGMA foreign_keys = ON');

  _db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, avatar TEXT DEFAULT NULL, status TEXT DEFAULT 'offline',
    role TEXT DEFAULT 'user', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL,
    icon TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS server_members (
    server_id TEXT NOT NULL, user_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (server_id, user_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY, server_id TEXT NOT NULL, name TEXT NOT NULL,
    type TEXT DEFAULT 'text', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, user_id TEXT NOT NULL,
    content TEXT NOT NULL, attachment TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS direct_messages (
    id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, receiver_id TEXT NOT NULL,
    content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, friend_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY, server_id TEXT NOT NULL, name TEXT NOT NULL,
    color TEXT DEFAULT '#99aab5', permissions INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS role_members (
    role_id TEXT NOT NULL, user_id TEXT NOT NULL,
    PRIMARY KEY (role_id, user_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  saveDb();
}

const db = {
  prepare(sql) {
    const stmt = _db.prepare(sql);
    return {
      get(...params) {
        try {
          stmt.bind(params);
          if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          stmt.free();
          throw e;
        }
      },
      all(...params) {
        try {
          stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (e) {
          stmt.free();
          throw e;
        }
      },
      run(...params) {
        try {
          stmt.bind(params);
          stmt.step();
          stmt.free();
          saveDb();
          return { changes: _db.getRowsModified() };
        } catch (e) {
          stmt.free();
          throw e;
        }
      }
    };
  },
  exec(sql) {
    _db.exec(sql);
    saveDb();
  },
  transaction(fn) {
    return (...args) => {
      _db.run('BEGIN TRANSACTION');
      try {
        fn(...args);
        _db.run('COMMIT');
        saveDb();
      } catch (e) {
        _db.run('ROLLBACK');
        throw e;
      }
    };
  }
};

module.exports = { db, initDb, saveDb };
