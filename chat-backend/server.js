
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Database = require('./database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "https://chat-frontend-wrp5.onrender.com",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const db = new Database();

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "https://chat-frontend-wrp5.onrender.com",
    "http://localhost:5173"
  ]
}));
app.use(express.json());

// Store active connections
const activeUsers = new Map(); // socketId -> user info
const roomUsers = new Map(); // roomId -> Set of user objects

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const messages = await db.getMessages(roomId, limit, offset);
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/rooms/:roomId/users', (req, res) => {
  const { roomId } = req.params;
  const users = Array.from(roomUsers.get(roomId) || []);
  res.json({ users, count: users.length });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining a room
  socket.on('join-room', async (data) => {
    try {
      const { username, roomId, userId } = data;
      
      if (!username || !roomId) {
        socket.emit('error', { message: 'Username and room ID are required' });
        return;
      }

      const user = {
        id: userId || uuidv4(),
        username,
        roomId,
        socketId: socket.id,
        joinedAt: new Date().toISOString()
      };

      // Store user info
      activeUsers.set(socket.id, user);
      
      // Add user to room
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }
      roomUsers.get(roomId).add(user);

      // Join socket room
      socket.join(roomId);

      // Save user to database
      await db.saveUser(user);

      // Notify user of successful join
      socket.emit('joined-room', { user, roomId });

      // Broadcast to room that user joined
      socket.to(roomId).emit('user-joined', { user });

      // Send updated user list to room
      const roomUsersList = Array.from(roomUsers.get(roomId) || []);
      io.to(roomId).emit('room-users-updated', { users: roomUsersList });

      console.log(`${username} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle sending messages
  socket.on('send-message', async (data) => {
    try {
      const { text, replyTo } = data;
      const user = activeUsers.get(socket.id);
      
      if (!user || !text || !text.trim()) {
        return;
      }

      const message = {
        id: uuidv4(),
        text: text.trim(),
        username: user.username,
        userId: user.id,
        roomId: user.roomId,
        timestamp: new Date().toISOString(),
        replyTo: replyTo || null,
        status: 'sent',
        edited: false,
        deleted: false
      };

      // Save to database
      await db.saveMessage(message);
      
      // Broadcast to room
      socket.to(user.roomId).emit('new-message', { message });
      
      // Send back to sender for confirmation
      socket.emit('new-message', { message });
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });


  // Handle message editing
  socket.on('edit-message', async (data) => {
    try {
      const { messageId, newText } = data;
      const user = activeUsers.get(socket.id);
      
      if (!user || !messageId || !newText) return;

      // Update message in database
      const updatedMessage = {
        id: messageId,
        text: newText.trim(),
        edited: true,
        editedAt: new Date().toISOString()
      };

      // Broadcast edited message to room
      io.to(user.roomId).emit('message-edited', { updatedMessage });
      
    } catch (error) {
      console.error('Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });


  // Handle typing indicators
  socket.on('typing-start', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.to(user.roomId).emit('user-typing', { userId: user.id });
    }
  });

  socket.on('typing-stop', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.to(user.roomId).emit('user-stopped-typing', { userId: user.id });
    }
  });

  // Handle user leaving room explicitly
  socket.on('leave-room', async () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      try {
        // Remove user data from database
        await db.removeUser(user.id);
        await db.removeUserMessages(user.id);
        
        console.log(`${user.username} left room ${user.roomId} - data cleaned up`);
        
        // Remove from active users
        activeUsers.delete(socket.id);
        
        // Remove from room users
        const roomUserSet = roomUsers.get(user.roomId);
        if (roomUserSet) {
          for (const roomUser of roomUserSet) {
            if (roomUser.socketId === socket.id) {
              roomUserSet.delete(roomUser);
              break;
            }
          }
          
          if (roomUserSet.size === 0) {
            roomUsers.delete(user.roomId);
          } else {
            const remainingUsers = Array.from(roomUserSet);
            socket.to(user.roomId).emit('user-left', { user });
            socket.to(user.roomId).emit('room-users-updated', { users: remainingUsers });
          }
        }
        
        socket.emit('left-room', { success: true });
      } catch (error) {
        console.error('Error during user leave:', error);
        socket.emit('error', { message: 'Failed to leave room properly' });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      console.log(`${user.username} disconnected from room ${user.roomId}`);
      
      // Remove from active users
      activeUsers.delete(socket.id);
      
      // Remove from room users
      const roomUserSet = roomUsers.get(user.roomId);
      if (roomUserSet) {
        // Remove user with matching socket ID
        for (const roomUser of roomUserSet) {
          if (roomUser.socketId === socket.id) {
            roomUserSet.delete(roomUser);
            break;
          }
        }
        
        // Clean up empty rooms
        if (roomUserSet.size === 0) {
          roomUsers.delete(user.roomId);
        } else {
          // Notify remaining users
          const remainingUsers = Array.from(roomUserSet);
          socket.to(user.roomId).emit('user-left', { user });
          socket.to(user.roomId).emit('room-users-updated', { users: remainingUsers });
        }
      }
    }
    
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Cleanup scheduler
function startCleanupScheduler() {
  // Run cleanup every hour
  const cleanupInterval = setInterval(async () => {
    try {
      console.log('Running scheduled database cleanup...');
      const stats = await db.getOldDataStats(24);
      console.log('Data to cleanup:', stats);
      
      if (stats.oldMessages > 0 || stats.oldUsers > 0 || stats.oldRooms > 0) {
        await db.cleanupOldData(24);
        console.log('Scheduled cleanup completed successfully');
      } else {
        console.log('No old data to cleanup');
      }
    } catch (error) {
      console.error('Error during scheduled cleanup:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Initial cleanup on startup
  setTimeout(async () => {
    try {
      console.log('Running initial database cleanup...');
      await db.cleanupOldData(24);
      console.log('Initial cleanup completed');
    } catch (error) {
      console.error('Error during initial cleanup:', error);
    }
  }, 5000); // 5 seconds after startup

  return cleanupInterval;
}

// Initialize database and start server
async function startServer() {
  try {
    await db.initialize();
    console.log('Database initialized successfully');
    
    // Start cleanup scheduler
    const cleanupInterval = startCleanupScheduler();
    
    server.listen(PORT, () => {
      console.log(`Chat backend server running on port ${PORT}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
      console.log('Automatic cleanup enabled: 24-hour data retention');
    });

    // Store cleanup interval for graceful shutdown
    server.cleanupInterval = cleanupInterval;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  
  // Clear cleanup interval
  if (server.cleanupInterval) {
    clearInterval(server.cleanupInterval);
    console.log('Cleanup scheduler stopped');
  }
  
  await db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
