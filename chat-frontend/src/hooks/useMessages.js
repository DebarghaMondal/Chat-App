import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

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
        const response = await fetch(`${API_BASE_URL}/api/rooms/${user.roomId}/messages`);
        
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
      // Debug
      try { console.debug('[socket] new-message', message); } catch {}
      setMessages(prev => {
        // Avoid duplicates
        const incomingId = message?.id || message?._id;
        if (prev.some(msg => (msg.id || msg._id) === incomingId)) {
          return prev;
        }
        const normalized = { ...message };
        if (!normalized.id && normalized._id) normalized.id = normalized._id;
        if (normalized.userId && user?.id && normalized.userId === user.id && !normalized.status) {
          normalized.status = 'sent';
        }
        const updated = [...prev, normalized];
        
        // Also save to localStorage as backup
        try {
          localStorage.setItem(`chat-messages-${user.roomId}`, JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save to localStorage:', err);
        }
        
        return updated;
      });

      // Emit delivery receipt for messages from others
      try {
        if (message?.id && message?.userId && user?.id && message.userId !== user.id) {
          socket.emit('mark-delivered', { roomId: user.roomId, messageId: message.id });
        }
      } catch {}
    };

    // Update message on edit events from server
    const handleMessageEdited = (data) => {
      // Support different payload shapes from backend
      // Could be { message } or { messageId, newText } or { updated }
      const msg = data?.message || data?.updated || null;
      const messageId = data?.messageId || msg?.id;
      const newText = data?.newText || msg?.text;
      if (!messageId) return;

      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === messageId ? { ...m, text: newText ?? m.text, edited: true } : m
        );
        try {
          localStorage.setItem(`chat-messages-${user.roomId}`, JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save to localStorage:', err);
        }
        return updated;
      });
    };

    // Delivery receipts for messages
    const handleMessageDelivered = (data) => {
      try { console.debug('[socket] delivered', data); } catch {}
      const id = data?.messageId || data?.id || data?.message?.id || data?._id || data?.message?._id;
      if (!id) return;
      setMessages(prev => {
        const updated = prev.map(m => (m.id === id || m._id === id) ? { ...m, status: 'delivered' } : m);
        try {
          localStorage.setItem(`chat-messages-${user.roomId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    // Read receipts for messages
    const handleMessageRead = (data) => {
      try { console.debug('[socket] read', data); } catch {}
      // Could be a single id or array of ids
      const ids = (data?.messageIds || data?.ids || [data?.messageId || data?.id || data?.message?.id || data?._id || data?.message?._id]).filter(Boolean);
      if (!ids || ids.length === 0) return;
      setMessages(prev => {
        const updated = prev.map(m => ids.includes(m.id) || ids.includes(m._id) ? { ...m, status: 'read' } : m);
        try {
          localStorage.setItem(`chat-messages-${user.roomId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-updated', handleMessageEdited);
    socket.on('edit-message-success', handleMessageEdited);
    socket.on('message-delivered', handleMessageDelivered);
    socket.on('delivered', handleMessageDelivered);
    socket.on('message-read', handleMessageRead);
    socket.on('messages-read', handleMessageRead);
    socket.on('read', handleMessageRead);
    // Common alternative event names for read receipts
    socket.on('message-seen', handleMessageRead);
    socket.on('messages-seen', handleMessageRead);
    socket.on('seen', handleMessageRead);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-updated', handleMessageEdited);
      socket.off('edit-message-success', handleMessageEdited);
      socket.off('message-delivered', handleMessageDelivered);
      socket.off('delivered', handleMessageDelivered);
      socket.off('message-read', handleMessageRead);
      socket.off('messages-read', handleMessageRead);
      socket.off('read', handleMessageRead);
      socket.off('message-seen', handleMessageRead);
      socket.off('messages-seen', handleMessageRead);
      socket.off('seen', handleMessageRead);
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

  // Helper to optimistically update a message locally
  const updateMessage = (messageId, updater) => {
    setMessages(prev => {
      const updated = prev.map(m => m.id === messageId ? { ...m, ...(typeof updater === 'function' ? updater(m) : updater) } : m);
      if (user?.roomId) {
        try {
          localStorage.setItem(`chat-messages-${user.roomId}`, JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save to localStorage:', err);
        }
      }
      return updated;
    });
  };

  return {
    messages,
    loading,
    error,
    addMessage,
    clearMessages,
    updateMessage
  };
}
