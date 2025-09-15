const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'chat.db');
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        room_id TEXT NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createRoomsTable = `
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT
      )
    `;

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        room_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (room_id) REFERENCES rooms (id)
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_users_room_id ON users(room_id)'
    ];

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createUsersTable);
        this.db.run(createRoomsTable);
        this.db.run(createMessagesTable);
        
        createIndexes.forEach(indexQuery => {
          this.db.run(indexQuery);
        });

        console.log('Database tables created successfully');
        resolve();
      });
    });
  }

  async saveUser(user) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO users (id, username, room_id, joined_at, last_seen)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        user.id,
        user.username,
        user.roomId,
        user.joinedAt,
        new Date().toISOString()
      ], function(err) {
        if (err) {
          console.error('Error saving user:', err);
          reject(err);
          return;
        }
        resolve({ id: user.id, changes: this.changes });
      });
    });
  }

  async saveMessage(message) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO messages (id, user_id, username, room_id, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        message.id,
        message.userId,
        message.username,
        message.roomId,
        message.text,
        message.createdAt
      ], function(err) {
        if (err) {
          console.error('Error saving message:', err);
          reject(err);
          return;
        }
        resolve({ id: message.id, changes: this.changes });
      });
    });
  }

  async getMessages(roomId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, user_id as userId, username, room_id as roomId, text, created_at as createdAt
        FROM messages
        WHERE room_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(query, [roomId, limit, offset], (err, rows) => {
        if (err) {
          console.error('Error fetching messages:', err);
          reject(err);
          return;
        }
        // Reverse to get chronological order (oldest first)
        resolve(rows.reverse());
      });
    });
  }

  async getRoomUsers(roomId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT id, username, room_id as roomId, joined_at as joinedAt, last_seen as lastSeen
        FROM users
        WHERE room_id = ?
        ORDER BY joined_at ASC
      `;
      
      this.db.all(query, [roomId], (err, rows) => {
        if (err) {
          console.error('Error fetching room users:', err);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async createRoom(roomId, createdBy = null, name = null) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO rooms (id, name, created_by, created_at)
        VALUES (?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        roomId,
        name,
        createdBy,
        new Date().toISOString()
      ], function(err) {
        if (err) {
          console.error('Error creating room:', err);
          reject(err);
          return;
        }
        resolve({ id: roomId, changes: this.changes });
      });
    });
  }

  async getRoomInfo(roomId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, name, created_at as createdAt, created_by as createdBy
        FROM rooms
        WHERE id = ?
      `;
      
      this.db.get(query, [roomId], (err, row) => {
        if (err) {
          console.error('Error fetching room info:', err);
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async updateUserLastSeen(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users
        SET last_seen = ?
        WHERE id = ?
      `;
      
      this.db.run(query, [new Date().toISOString(), userId], function(err) {
        if (err) {
          console.error('Error updating user last seen:', err);
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      });
    });
  }

  async removeUser(userId) {
    return new Promise((resolve, reject) => {
      const query = `DELETE FROM users WHERE id = ?`;
      
      this.db.run(query, [userId], function(err) {
        if (err) {
          console.error('Error removing user:', err);
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      });
    });
  }

  async removeUserMessages(userId) {
    return new Promise((resolve, reject) => {
      const query = `DELETE FROM messages WHERE user_id = ?`;
      
      this.db.run(query, [userId], function(err) {
        if (err) {
          console.error('Error removing user messages:', err);
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      });
    });
  }

  async cleanupOldData(hoursOld = 24) {
    const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000)).toISOString();
    
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Remove old messages
        this.db.run(
          `DELETE FROM messages WHERE created_at < ?`,
          [cutoffTime],
          function(err) {
            if (err) {
              console.error('Error cleaning old messages:', err);
              reject(err);
              return;
            }
            console.log(`Cleaned up ${this.changes} old messages`);
          }
        );

        // Remove old users
        this.db.run(
          `DELETE FROM users WHERE last_seen < ?`,
          [cutoffTime],
          function(err) {
            if (err) {
              console.error('Error cleaning old users:', err);
              reject(err);
              return;
            }
            console.log(`Cleaned up ${this.changes} old users`);
          }
        );

        // Remove empty rooms (rooms with no recent messages)
        this.db.run(
          `DELETE FROM rooms WHERE id NOT IN (
            SELECT DISTINCT room_id FROM messages 
            WHERE created_at >= ?
          )`,
          [cutoffTime],
          function(err) {
            if (err) {
              console.error('Error cleaning old rooms:', err);
              reject(err);
              return;
            }
            console.log(`Cleaned up ${this.changes} old rooms`);
            resolve({ 
              messagesRemoved: this.changes,
              timestamp: new Date().toISOString()
            });
          }
        );
      });
    });
  }

  async getOldDataStats(hoursOld = 24) {
    const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000)).toISOString();
    
    return new Promise((resolve, reject) => {
      const queries = {
        oldMessages: `SELECT COUNT(*) as count FROM messages WHERE created_at < ?`,
        oldUsers: `SELECT COUNT(*) as count FROM users WHERE last_seen < ?`,
        oldRooms: `SELECT COUNT(*) as count FROM rooms WHERE id NOT IN (
          SELECT DISTINCT room_id FROM messages WHERE created_at >= ?
        )`
      };

      const results = {};
      let completed = 0;
      const total = Object.keys(queries).length;

      Object.entries(queries).forEach(([key, query]) => {
        this.db.get(query, [cutoffTime], (err, row) => {
          if (err) {
            console.error(`Error getting ${key} stats:`, err);
            reject(err);
            return;
          }
          results[key] = row.count;
          completed++;
          
          if (completed === total) {
            resolve(results);
          }
        });
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;
