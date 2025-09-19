import { useState, useEffect, useRef } from "react";
import useSocket from "../hooks/useSocket";
import useMessages from "../hooks/useMessages";
import useRoomUsers from "../hooks/useRoomUsers";
import useMentions from "../hooks/useMentions";
import { useTheme } from "../contexts/ThemeContext";
import MentionAutocomplete from "./MentionAutocomplete";
import ThemeToggle from "./ThemeToggle";
import Toast from "./Toast";
import ReplyPreview from "./ReplyPreview";
import MessageBubble from "./MessageBubble";
// FileUpload removed as per requirement

export default function ChatRoom({ user, onLeave }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Inline attachment state (Telegram-like)
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const { isDark } = useTheme();

  // Backend hooks
  const { socket, connected, error: socketError, sendMessage, startTyping, stopTyping, toggleRoomLock } = useSocket(user);
  const { messages, loading: messagesLoading, error: messagesError, updateMessage } = useMessages(socket, user);
  const { users: roomUsers, typingUsers } = useRoomUsers(socket, user);
  
  // Mention hooks
  const {
    showAutocomplete,
    mentionQuery,
    mentionPosition,
    inputRef,
    handleInputChange: handleMentionInputChange,
    handleMentionSelect,
    closeMentionAutocomplete,
    renderTextWithMentions,
    isMentioned
  } = useMentions(roomUsers, user);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for lock state updates and show a toast
  useEffect(() => {
    if (!socket) return;
    const handleLockChanged = ({ roomId, locked }) => {
      setIsLocked(Boolean(locked));
      setToastMessage(locked ? 'Room is now locked. New users cannot join.' : 'Room unlocked. New users can join.');
      setShowToast(true);
    };
    socket.on('room-lock-changed', handleLockChanged);
    return () => {
      socket.off('room-lock-changed', handleLockChanged);
    };
  }, [socket]);

  // Optimistic toast on toggle click
  const handleToggleLock = () => {
    try {
      // Show an immediate intent toast; final state toast will come from server
      const intent = isLocked ? 'Unlocking room...' : 'Locking room...';
      setToastMessage(intent);
      setShowToast(true);
      if (connected) {
        toggleRoomLock();
      }
    } catch (e) {
      setToastMessage('Failed to toggle room lock');
      setShowToast(true);
    }
  };

  // Track scroll position to determine if user is at bottom
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setIsAtBottom(nearBottom);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    // Initialize
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Inline attachment handlers
  const handleAttachClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingMessage) return; // do not allow attachments while editing
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      console.warn('Only images are supported in inline attach');
      return;
    }
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setSelectedImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearSelectedImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Emit read receipts when at bottom (messages visible)
  useEffect(() => {
    if (!socket || !connected) return;
    if (!isAtBottom) return;
    if (!messages || messages.length === 0) return;

    // Collect recent messages from others to mark as read
    const otherMsgIds = messages
      .filter(m => m.userId && m.userId !== user.id)
      .slice(-50) // cap to avoid huge payloads
      .map(m => m.id)
      .filter(Boolean);

    if (otherMsgIds.length > 0) {
      const payload = { roomId: user.roomId, messageIds: otherMsgIds };
      socket.emit('mark-read', payload);
      // Send common aliases for broader backend compatibility
      socket.emit('message-read', payload);
      socket.emit('messages-read', payload);
      socket.emit('seen', payload);
      socket.emit('messages-seen', payload);
    }
  }, [messages, isAtBottom, connected, socket, user?.id, user?.roomId]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
      }
    };

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileMenu]);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !selectedImageFile) || !connected) return;

    console.log('Sending message with replyingTo:', replyingTo);

    if (editingMessage) {
      // Edit existing message
      const newText = text.trim();
      socket.emit('edit-message', { messageId: editingMessage.id, newText });
      // Optimistically update UI
      if (updateMessage) {
        updateMessage(editingMessage.id, { text: newText, edited: true });
      }
      setEditingMessage(null);
    } else {
      // Send new message (with optional image attachment)
      if (selectedImageFile && selectedImageFile.type?.startsWith('image/')) {
        try {
          const reader = new FileReader();
          const imageData = await new Promise((resolve, reject) => {
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(selectedImageFile);
          });

          const fileMessage = {
            text: text.trim() ? text.trim() : `🖼️ ${selectedImageFile.name}`,
            fileType: selectedImageFile.type,
            fileName: selectedImageFile.name,
            fileSize: selectedImageFile.size,
            imageData,
            isImage: true,
            replyTo: replyingTo || null,
          };

          if (socket && connected) {
            socket.emit('send-message', fileMessage);
          }
        } catch (err) {
          console.error('Failed to read image:', err);
        }
      } else if (text.trim()) {
        // Text-only message
        sendMessage(text, replyingTo);
      }

      // Clear reply after sending
      setReplyingTo(null);
    }
    
    // Reset input and attachment
    setText("");
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    // Stop typing indicator
    if (isTyping) {
      stopTyping();
      setIsTyping(false);
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleInputChange = (e) => {
    // Handle mentions first
    handleMentionInputChange(e, setText);
    
    // Handle typing indicators
    if (connected && e.target.value.trim()) {
      if (!isTyping) {
        startTyping();
        setIsTyping(true);
      }
      
      // Reset typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          stopTyping();
          setIsTyping(false);
        }
      }, 2000);
    } else if (isTyping) {
      stopTyping();
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}?room=${user.roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setToastMessage("Room link copied to clipboard!");
      setShowToast(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      setToastMessage("Failed to copy link");
      setShowToast(true);
    });
  };

  const handleReply = (message) => {
    console.log('handleReply called with message:', message);
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };


  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setText(message.text);
    inputRef.current?.focus();
  };

  const handleLeave = () => {
    // Emit leave-room event to clean up user data
    if (socket && connected) {
      socket.emit('leave-room');
    }
    
    localStorage.removeItem("chat-user");
    window.history.replaceState({}, "", "/");
    if (onLeave) onLeave();
  };

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 ${
      isDark ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`border-b px-4 py-2 sm:py-2.5 transition-colors duration-300 ${
        isDark 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-blue-600 border-blue-500'
      }`}>
        {/* Mobile Layout */}
        <div className="flex flex-col space-y-2 sm:hidden">
          {/* Top Row - Avatar, Title, and Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Group Avatar */}
              <div className="relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isDark 
                    ? 'bg-blue-500' 
                    : 'bg-white shadow-lg'
                }`}>
                  <svg className={`w-4 h-4 ${isDark ? 'text-white' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                    <path d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                  </svg>
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 rounded-full ${
                  isDark 
                    ? 'bg-green-400 border-gray-700' 
                    : 'bg-green-500 border-white'
                }`}></div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h1 className={`font-semibold text-base truncate transition-colors duration-300 ${
                    isDark ? 'text-white' : 'text-white drop-shadow-sm'
                  }`}>
                    Group Chat
                  </h1>
                  
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-white/20 text-white backdrop-blur-sm'
                  }`}>
                    {roomUsers.length} online
                  </span>
                </div>
                
                {/* Mobile Online Users Display */}
                <div className={`text-xs mt-1 transition-colors duration-300 ${
                  isDark ? 'text-gray-300' : 'text-white/90'
                }`}>
                  {roomUsers.length > 0 ? (
                    <div className="flex items-center space-x-1 overflow-hidden">
                      <div className="flex -space-x-1 mr-1">
                        {roomUsers.slice(0, 3).map((roomUser) => (
                          <div
                            key={roomUser.id}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-xs font-semibold ${
                              roomUser.id === user.id
                                ? 'bg-blue-500 text-white border-white'
                                : 'bg-gray-500 text-white border-white'
                            }`}
                            title={roomUser.username}
                          >
                            {roomUser.username.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {roomUsers.length > 3 && (
                          <div className={`w-4 h-4 rounded-full border border-white flex items-center justify-center text-xs font-semibold ${
                            isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-400 text-white'
                          }`}>
                            +{roomUsers.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="truncate text-xs">
                        {roomUsers.length === 1 
                          ? 'Just you'
                          : roomUsers.length === 2
                            ? `You and ${roomUsers.find(u => u.id !== user.id)?.username || 'another user'}`
                            : `You, ${roomUsers.filter(u => u.id !== user.id).slice(0, 1).map(u => u.username).join('')}${roomUsers.length > 2 ? ` +${roomUsers.length - 2} others` : ''}`
                        }
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs">No users online</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Mobile Menu */}
            <div className="relative" ref={mobileMenuRef}>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  isDark 
                    ? 'hover:bg-gray-700 text-gray-300' 
                    : 'hover:bg-white/20 text-white'
                }`}
                aria-label="More options"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showMobileMenu && (
                <div className={`absolute right-0 top-full mt-2 w-48 rounded-lg shadow-lg border z-50 ${
                  isDark 
                    ? 'bg-gray-800 border-gray-600' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="py-2">
                    {/* Lock/Unlock - Mobile icon entry */}
                    <button
                      onClick={() => { handleToggleLock(); setShowMobileMenu(false); }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors duration-200 flex items-center gap-2 ${
                        isDark ? 'text-white hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-50'
                      }`}
                      title={isLocked ? 'Unlock room (allow joins)' : 'Lock room (block joins)'}
                      aria-label={isLocked ? 'Unlock room' : 'Lock room'}
                      type="button"
                    >
                      {isLocked ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 8V7a5 5 0 1110 0v1h1a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1h1zm2-1a3 3 0 116 0v1H7V7z" clipRule="evenodd"/></svg>
                          <span>Unlock Room</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a5 5 0 00-5 5v1H4a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1V9a1 1 0 00-1-1h-1V7a5 5 0 00-5-5zm-3 6V7a3 3 0 016 0v1H7z"/></svg>
                          <span>Lock Room</span>
                        </>
                      )}
                    </button>
                    
                    {/* Theme Toggle */}
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Theme
                        </span>
                        <ThemeToggle />
                      </div>
                    </div>

                    {/* Invite Friends */}
                    <button
                      onClick={() => {
                        copyRoomLink();
                        setShowMobileMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors duration-200 flex items-center space-x-2 ${
                        copied 
                          ? isDark
                            ? 'text-green-400 hover:bg-gray-700'
                            : 'text-green-700 hover:bg-gray-50'
                          : isDark
                            ? 'text-gray-300 hover:bg-gray-700'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {copied ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                        </svg>
                      )}
                      <span>{copied ? "Link Copied!" : "Invite Friends"}</span>
                    </button>

                    {/* Leave Room */}
                    <button
                      onClick={() => {
                        handleLeave();
                        setShowMobileMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors duration-200 flex items-center space-x-2 ${
                        isDark 
                          ? 'text-red-400 hover:bg-gray-700' 
                          : 'text-red-600 hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                      </svg>
                      <span>Leave Room</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Group Avatar */}
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isDark 
                  ? 'bg-blue-500' 
                  : 'bg-white shadow-lg'
              }`}>
                <svg className={`w-5 h-5 ${isDark ? 'text-white' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                  <path d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                </svg>
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 rounded-full ${
                isDark 
                  ? 'bg-green-400 border-gray-700' 
                  : 'bg-green-500 border-white'
              }`}></div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                <h1 className={`font-semibold text-lg truncate transition-colors duration-300 ${
                  isDark ? 'text-white' : 'text-white drop-shadow-sm'
                }`}>
                  Group Chat
                </h1>
                
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-white/20 text-white backdrop-blur-sm'
                }`}>
                  {roomUsers.length} online
                </span>
              </div>
              
              {/* Enhanced user list */}
              <div className={`text-sm mt-1 transition-colors duration-300 ${
                isDark ? 'text-gray-300' : 'text-white/90'
              }`}>
                {roomUsers.length > 0 ? (
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <div className="flex -space-x-1 mr-2">
                      {roomUsers.slice(0, 4).map((roomUser) => (
                        <div
                          key={roomUser.id}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${
                            roomUser.id === user.id
                              ? 'bg-blue-500 text-white border-white'
                              : 'bg-gray-500 text-white border-white'
                          }`}
                          title={roomUser.username}
                        >
                          {roomUser.username.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {roomUsers.length > 4 && (
                        <div className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold ${
                          isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-400 text-white'
                        }`}>
                          +{roomUsers.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="truncate font-medium">
                      {roomUsers.length === 1 
                        ? 'Just you'
                        : roomUsers.length === 2
                          ? `You and ${roomUsers.find(u => u.id !== user.id)?.username || 'another user'}`
                          : `You, ${roomUsers.filter(u => u.id !== user.id).slice(0, 2).map(u => u.username).join(', ')}${roomUsers.length > 3 ? ` and ${roomUsers.length - 3} others` : ''}`
                      }
                    </span>
                  </div>
                ) : (
                  <span>No users online</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Lock/Unlock icon-only */}
            <button
              onClick={handleToggleLock}
              className={`p-2.5 rounded-lg transition-all duration-200 flex items-center justify-center ${
                isLocked
                  ? (isDark ? 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50 border border-yellow-700' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300')
                  : (isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300')
              }`}
              title={isLocked ? 'Unlock room (allow joins)' : 'Lock room (block joins)'}
              aria-label={isLocked ? 'Unlock room' : 'Lock room'}
              type="button"
            >
              {isLocked ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 8V7a5 5 0 1110 0v1h1a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1h1zm2-1a3 3 0 116 0v1H7V7z" clipRule="evenodd"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a5 5 0 00-5 5v1H4a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1V9a1 1 0 00-1-1h-1V7a5 5 0 00-5-5zm-3 6V7a3 3 0 016 0v1H7z"/></svg>
              )}
            </button>
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Invite Friends Button */}
            <button
              onClick={copyRoomLink}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                copied 
                  ? isDark
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : 'bg-green-100 text-green-700 border border-green-300'
                  : isDark
                    ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-800/50 border border-blue-700'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
              }`}
              title={copied ? "Invite link copied!" : "Copy invite link to share with friends"}
            >
              {copied ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                </svg>
              )}
              <span>{copied ? "Link Copied!" : "Invite Friends"}</span>
            </button>
            
            {/* Leave Button */}
            <button
              onClick={handleLeave}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                isDark 
                  ? 'bg-red-900/50 text-red-400 hover:bg-red-800/50 border border-red-700 hover:shadow-lg'
                  : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 hover:shadow-lg'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
              <span>Leave Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type="success"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={2000}
      />

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent touch-pan-y">
        {/* Connection Status */}
        {!connected && (
          <div className={`border px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-3 sm:mb-4 transition-colors duration-300 ${
            isDark 
              ? 'bg-yellow-900/50 border-yellow-700 text-yellow-300'
              : 'bg-yellow-100 border-yellow-400 text-yellow-700'
          }`}>
            <div className="flex items-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm sm:text-base">Reconnecting to chat...</span>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {(socketError || messagesError) && (
          <div className={`border px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-3 sm:mb-4 transition-colors duration-300 ${
            isDark 
              ? 'bg-red-900/50 border-red-700 text-red-300'
              : 'bg-red-100 border-red-400 text-red-700'
          }`}>
            <div className="flex items-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm sm:text-base">{socketError || messagesError}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {messagesLoading && (
          <div className="flex justify-center py-6 sm:py-8">
            <div className={`animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 ${
              isDark ? 'border-blue-400' : 'border-blue-600'
            }`}></div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, idx) => {
          const isSelfMessage = message.userId === user.id;
          // Stable key to prevent DOM reorder across reloads
          const key = `msg-${message.id || message._id || message._seq || idx}`;
          return (
            <MessageBubble
              key={key}
              message={message}
              isSelfMessage={isSelfMessage}
              user={user}
              renderTextWithMentions={renderTextWithMentions}
              onReply={handleReply}
              messages={messages}
              onEdit={handleEditMessage}
            />
          );
        })}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className={`border px-3 sm:px-4 py-2 rounded-lg max-w-[280px] sm:max-w-xs transition-colors duration-300 ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-gray-300'
                : 'bg-gray-100 border-gray-200 text-gray-600'
            }`}>
              <div className="text-xs">
                {typingUsers.length === 1
                  ? `${typingUsers[0].username} is typing...`
                  : `${typingUsers.slice(0, -1).map(u => u.username).join(", ")} and ${
                      typingUsers[typingUsers.length - 1].username
                    } are typing...`}
              </div>
              <div className="flex space-x-1 mt-1">
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce ${
                  isDark ? 'bg-gray-500' : 'bg-gray-400'
                }`}></div>
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce ${
                  isDark ? 'bg-gray-500' : 'bg-gray-400'
                }`} style={{ animationDelay: "0.1s" }}></div>
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce ${
                  isDark ? 'bg-gray-500' : 'bg-gray-400'
                }`} style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className={`border-t shadow-lg transition-colors duration-300 ${
          isDark 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="max-w-4xl w-full mx-auto p-2 sm:p-3 relative">
          {/* Reply Preview */}
          {replyingTo && (
            <ReplyPreview 
              message={replyingTo} 
              onCancel={handleCancelReply} 
            />
          )}
          
          {/* Selected image preview chip */}
          {selectedImagePreview && !editingMessage && (
            <div className="mb-2 flex items-center gap-2">
              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-xs sm:text-sm max-w-full overflow-hidden ${
                isDark ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}>
                <img src={selectedImagePreview} alt="preview" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                <span className="truncate max-w-[50vw] sm:max-w-xs">{selectedImageFile?.name}</span>
                <button type="button" onClick={clearSelectedImage} className={`ml-1 p-1 rounded ${isDark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-600'}`} aria-label="Remove image">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

          {/* Input with inline attach icon */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              placeholder={editingMessage ? "Edit message..." : connected ? "Type a message... (use @ to mention)" : "Connecting..."}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!connected}
              className={`w-full pr-12 pl-3 sm:pl-4 py-2 sm:py-3 border-2 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base touch-manipulation transition-colors duration-300 ${
                isDark 
                  ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 disabled:bg-gray-600'
                  : 'border-gray-200 bg-white text-gray-900 placeholder-gray-500 disabled:bg-gray-100'
              } disabled:cursor-not-allowed`}
              aria-label="Type a message"
            />
            {!editingMessage && (
              <button
                type="button"
                onClick={handleAttachClick}
                className={`absolute inset-y-0 right-2 my-auto p-2 rounded-md ${isDark ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                aria-label="Attach image"
                title="Attach image"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd"/></svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={(!text.trim() && !selectedImageFile) || !connected}
            className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm touch-manipulation transition-all duration-200 flex items-center space-x-1 sm:space-x-2 shadow-lg ${
              (!text.trim() && !selectedImageFile) || !connected
                ? isDark
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-xl active:scale-[0.98]'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-xl active:scale-[0.98]'
            }`}
            aria-disabled={(!text.trim() && !selectedImageFile) || !connected}
          >
            {connected ? (
              <>
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
                <span>{editingMessage ? 'Save' : 'Send'}</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>Offline</span>
              </>
            )}
          </button>
          
          {/* Mention Autocomplete */}
          <MentionAutocomplete
            users={roomUsers.filter(u => u.id !== user.id)}
            isVisible={showAutocomplete}
            onSelect={(selectedUser) => handleMentionSelect(selectedUser, text, setText)}
            onClose={closeMentionAutocomplete}
            position={mentionPosition}
            query={mentionQuery}
          />
          </div>
        </div>
      </form>

      {/* Developer Credit */}
      <div className={`border-t py-2 transition-colors duration-300 ${
        isDark 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="max-w-4xl w-full mx-auto px-4">
          <p className={`text-xs text-center flex items-center justify-center gap-1 transition-colors duration-300 ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Developed by Debargha
          </p>
        </div>
      </div>
    </div>
  );
}
