import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';

export default function useSocket(user) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user || !user.username || !user.roomId) {
      // Disconnect if user is not valid
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      setError(null);
      
      // Join room automatically on connection
      newSocket.emit('join-room', {
        username: user.username,
        roomId: user.roomId,
        userId: user.id
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setConnected(false);
      
      // Try to reconnect if it wasn't intentional
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError(`Connection failed: ${error.message}`);
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setError(error.message || 'An error occurred');
    });

    // Cleanup on unmount or user change
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id, user?.username, user?.roomId]);

  // Helper functions
  const sendMessage = (text, replyTo = null) => {
    if (socket && connected && text.trim()) {
      console.log('useSocket sendMessage called with:', { text: text.trim(), replyTo });
      socket.emit('send-message', { 
        text: text.trim(),
        replyTo: replyTo 
      });
    }
  };

  const startTyping = () => {
    if (socket && connected) {
      socket.emit('typing-start');
    }
  };

  const stopTyping = () => {
    if (socket && connected) {
      socket.emit('typing-stop');
    }
  };

  return {
    socket,
    connected,
    error,
    sendMessage,
    startTyping,
    stopTyping
  };
}
