import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config/api';

export default function useMessages(socket, user) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Persistent sequence counter to keep visual order stable across reloads
  const seqRef = useRef(0);

  const seqKey = (roomId) => `chat-seq-${roomId}`;
  const seqMapKey = (roomId) => `chat-seqmap-${roomId}`;

  const loadSeq = (roomId) => {
    if (!roomId) return 0;
    try {
      const val = localStorage.getItem(seqKey(roomId));
      const n = Number(val);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };

  const saveSeq = (roomId, n) => {
    if (!roomId) return;
    try {
      localStorage.setItem(seqKey(roomId), String(n));
    } catch {}
  };

  const initSeqFromMessages = (roomId, arr) => {
    const maxSeq = arr.reduce((max, m) => (typeof m._seq === 'number' && m._seq > max ? m._seq : max), 0);
    const loadedSeq = Math.max(maxSeq, loadSeq(roomId));
    seqRef.current = loadedSeq;
    saveSeq(roomId, seqRef.current);
  };

  const assignSeqIfMissing = (roomId, arr) => {
    const map = loadSeqMap(roomId);
    let changed = false;
    const out = arr.map((m) => {
      const id = m?.id || m?._id;
      const existing = id != null ? map[id] : undefined;
      if (typeof m._seq === 'number') {
        // keep existing sequence
        return m;
      }
      if (typeof existing === 'number') {
        // reuse stored sequence for stable order across reloads
        return { ...m, _seq: existing };
      }
      // assign a new sequence
      seqRef.current = (seqRef.current || 0) + 1;
      map[id ?? `noid-${seqRef.current}`] = seqRef.current;
      changed = true;
      return { ...m, _seq: seqRef.current };
    });
    if (changed) saveSeqMap(roomId, map);
    saveSeq(roomId, seqRef.current);
    return out;
  };

  const loadSeqMap = (roomId) => {
    if (!roomId) return {};
    try {
      const raw = localStorage.getItem(seqMapKey(roomId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveSeqMap = (roomId, map) => {
    if (!roomId) return;
    try {
      localStorage.setItem(seqMapKey(roomId), JSON.stringify(map));
    } catch {}
  };

  // Normalize chronological order like WhatsApp/Telegram: oldest on top, newest at bottom
  const getMsgTime = (m) => {
    const t = m?.timestamp || m?.createdAt || m?.time || m?.ts;
    if (!t) return 0;
    const n = typeof t === 'number' ? t : Date.parse(t);
    return Number.isFinite(n) ? n : 0;
  };
  const sortMessages = (arr) => {
    return [...arr]
      .map((m, i) => ({ m, i }))
      .sort((a, b) => {
        const ta = getMsgTime(a.m);
        const tb = getMsgTime(b.m);
        if (ta !== tb) return ta - tb; // oldest first
        return a.i - b.i; // stable fallback
      })
      .map(({ m }) => m);
  };

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
        const initial = Array.isArray(data.messages) ? data.messages : [];
        // Ensure stable _seq per message id across reloads
        initSeqFromMessages(user.roomId, initial);
        const withSeq = assignSeqIfMissing(user.roomId, initial);
        // Sort primarily by timestamp asc, then by _seq for stability
        const sorted = [...withSeq].sort((a, b) => {
          const ta = (typeof a.timestamp === 'number') ? a.timestamp : Date.parse(a.timestamp || a.createdAt || a.time || a.ts || 0) || 0;
          const tb = (typeof b.timestamp === 'number') ? b.timestamp : Date.parse(b.timestamp || b.createdAt || b.time || b.ts || 0) || 0;
          if (ta !== tb) return ta - tb;
          const sa = typeof a._seq === 'number' ? a._seq : 0;
          const sb = typeof b._seq === 'number' ? b._seq : 0;
          return sa - sb;
        });
        setMessages(sorted);
        setError(null);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError(err.message);
        // Fallback to localStorage if backend is unavailable
        try {
          const saved = localStorage.getItem(`chat-messages-${user.roomId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            const arr = Array.isArray(parsed) ? parsed : [];
            initSeqFromMessages(user.roomId, arr);
            const ensured = assignSeqIfMissing(user.roomId, arr);
            const sorted = [...ensured].sort((a, b) => {
              const ta = (typeof a.timestamp === 'number') ? a.timestamp : Date.parse(a.timestamp || a.createdAt || a.time || a.ts || 0) || 0;
              const tb = (typeof b.timestamp === 'number') ? b.timestamp : Date.parse(b.timestamp || b.createdAt || b.time || b.ts || 0) || 0;
              if (ta !== tb) return ta - tb;
              const sa = typeof a._seq === 'number' ? a._seq : 0;
              const sb = typeof b._seq === 'number' ? b._seq : 0;
              return sa - sb;
            });
            setMessages(sorted);
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
        // Assign a stable sequence if missing and append in arrival order
        if (typeof normalized._seq !== 'number') {
          const map = loadSeqMap(user.roomId);
          const id = normalized?.id || normalized?._id;
          const existing = id != null ? map[id] : undefined;
          if (typeof existing === 'number') {
            normalized._seq = existing;
          } else {
            seqRef.current = (seqRef.current || 0) + 1;
            saveSeq(user.roomId, seqRef.current);
            normalized._seq = seqRef.current;
            map[id ?? `noid-${seqRef.current}`] = seqRef.current;
            saveSeqMap(user.roomId, map);
          }
        }
        const updated = [...prev, normalized].sort((a, b) => {
          const ta = (typeof a.timestamp === 'number') ? a.timestamp : Date.parse(a.timestamp || a.createdAt || a.time || a.ts || 0) || 0;
          const tb = (typeof b.timestamp === 'number') ? b.timestamp : Date.parse(b.timestamp || b.createdAt || b.time || b.ts || 0) || 0;
          if (ta !== tb) return ta - tb;
          const sa = typeof a._seq === 'number' ? a._seq : 0;
          const sb = typeof b._seq === 'number' ? b._seq : 0;
          return sa - sb;
        });
        
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
