import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function useMessages(socket, user) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial messages from backend
  useEffect(() => {
    if (!user?.roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${BACKEND_URL}/api/rooms/${user.roomId}/messages`);
        
        if (!response.ok) {
          throw new Error(`Failed to load messages: ${response.status}`);
        }
        
        const data = await response.json();
        setMessages(data.messages || []);
        setError(null);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError(err.message);
        // Fallback to localStorage if backend is unavailable
        try {
          const saved = localStorage.getItem(`chat-messages-${user.roomId}`);
          if (saved) {
            setMessages(JSON.parse(saved));
          }
        } catch (localErr) {
          console.warn('Failed to load from localStorage:', localErr);
        }
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [user?.roomId]);

  // Listen for new messages from socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      const { message } = data;
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(msg => msg.id === message.id)) {
          return prev;
        }
        const updated = [...prev, message];
        
        // Also save to localStorage as backup
        try {
          localStorage.setItem(`chat-messages-${user.roomId}`, JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save to localStorage:', err);
        }
        
        return updated;
      });
    };

    socket.on('new-message', handleNewMessage);

    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, user?.roomId]);

  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  const clearMessages = () => {
    setMessages([]);
    if (user?.roomId) {
      localStorage.removeItem(`chat-messages-${user.roomId}`);
    }
  };

  return {
    messages,
    loading,
    error,
    addMessage,
    clearMessages
  };
}
