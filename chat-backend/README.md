# Chat Backend

A real-time chat application backend built with Node.js, Express, and Socket.IO.

## Features

- Real-time messaging with WebSocket support
- SQLite database for persistent message storage
- Room-based chat system
- User presence tracking
- Typing indicators
- CORS support for frontend integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start the server:
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on port 3001 by default.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/rooms/:roomId/messages` - Get messages for a room
- `GET /api/rooms/:roomId/users` - Get active users in a room

## Socket Events

### Client to Server
- `join-room` - Join a chat room
- `send-message` - Send a message
- `typing-start` - Start typing indicator
- `typing-stop` - Stop typing indicator

### Server to Client
- `joined-room` - Confirmation of room join
- `new-message` - New message received
- `user-joined` - User joined the room
- `user-left` - User left the room
- `room-users-updated` - Updated list of room users
- `user-typing` - User started typing
- `user-stopped-typing` - User stopped typing
- `error` - Error message

## Database Schema

The application uses SQLite with the following tables:
- `users` - User information and room associations
- `rooms` - Chat room metadata
- `messages` - Chat messages with timestamps

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode
- `FRONTEND_URL` - Frontend URL for CORS
- `DB_PATH` - SQLite database file path
