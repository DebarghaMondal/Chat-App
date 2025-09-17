import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import MessageActions from "./MessageActions";
import MessageStatus from "./MessageStatus";

export default function MessageBubble({ 
  message, 
  isSelfMessage, 
  user, 
  renderTextWithMentions, 
  onReply,
  messages,
  onEdit
}) {
  const { isDark } = useTheme();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Find the replied message if this message is a reply
  const repliedMessage = message.replyTo 
    ? messages.find(msg => msg.id === message.replyTo.id) || message.replyTo
    : null;

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Mobile touch handlers for long press and swipe
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    
    // Long press timer for context menu
    const timer = setTimeout(() => {
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Show context menu at touch position
      setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowContextMenu(true);
    }, 600); // 600ms long press (WhatsApp style)
    
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (!e.touches || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 15) {
      e.preventDefault(); // Only prevent default when we're actually swiping
      
      // WhatsApp style: Swipe right to reply
      if (deltaX > 30) {
        setIsSwipeActive(true);
        setSwipeDistance(Math.min(deltaX, 100));
      } else {
        setIsSwipeActive(false);
        setSwipeDistance(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // If swipe was active and distance was enough, trigger reply
    if (isSwipeActive && swipeDistance > 50) {
      console.log('Swipe reply triggered for message:', message);
      if (navigator.vibrate) {
        navigator.vibrate([30, 10, 20]); // WhatsApp-style vibration pattern
      }
      onReply(message);
    }
    
    // Reset swipe state
    setIsSwipeActive(false);
    setSwipeDistance(0);
  };

  const handleReply = () => {
    console.log('Reply clicked for message:', message);
    onReply(message);
    setShowContextMenu(false);
  };

  const handleClickOutside = () => {
    setShowContextMenu(false);
  };

  return (
    <>
      <div
        className={`flex ${isSelfMessage ? "justify-end" : "justify-start"} relative group`}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Reply icon that appears during swipe - Exact WhatsApp style */}
        {isSwipeActive && (
          <div 
            className="absolute top-1/2 transform -translate-y-1/2 z-10 transition-all duration-100 left-2"
            style={{ 
              opacity: Math.min(swipeDistance / 50, 1),
              transform: `translateY(-50%) scale(${Math.min(swipeDistance / 70, 1)})`
            }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
              swipeDistance > 50 
                ? 'bg-green-500 text-white' 
                : isDark 
                  ? 'bg-gray-600 text-gray-300' 
                  : 'bg-gray-300 text-gray-600'
            }`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}
        
        <div
          className={`max-w-[280px] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-lg transition-all duration-150 select-none ${
            isSelfMessage
              ? "bg-blue-600 text-white"
              : isDark
                ? "bg-gray-700 border border-gray-600 text-gray-100"
                : "bg-white border border-gray-200 text-gray-900"
          }`}
          style={{
            transform: isSwipeActive 
              ? `translateX(${swipeDistance}px)` 
              : 'translateX(0px)',
            touchAction: 'none'
          }}
        >
          {/* Show replied message if this is a reply */}
          {repliedMessage && (
            <div className={`border-l-2 pl-2 mb-2 text-xs opacity-75 ${
              isSelfMessage 
                ? 'border-blue-300' 
                : isDark 
                  ? 'border-gray-500' 
                  : 'border-gray-400'
            }`}>
              <div className="font-medium text-blue-400">
                {repliedMessage.username || 'Unknown User'}
              </div>
              <div className="truncate">
                {repliedMessage.isImage && repliedMessage.imageData ? (
                  <div className="flex items-center space-x-2">
                    <img 
                      src={repliedMessage.imageData} 
                      alt="Reply preview"
                      className="w-6 h-6 rounded object-cover flex-shrink-0"
                    />
                    <span className="truncate">{repliedMessage.text || 'Image'}</span>
                  </div>
                ) : (
                  repliedMessage.text || 'Message not found'
                )}
              </div>
            </div>
          )}

          {!isSelfMessage && (
            <div className={`text-xs mb-1 font-medium transition-colors duration-300 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {message.username}
            </div>
          )}
          
          <div className="text-sm mb-1 sm:mb-2">
            {message.isImage && message.imageData ? (
              <div className="space-y-2">
                <div className="text-xs opacity-75">
                  {renderTextWithMentions(message.text)}
                </div>
                <div className="relative">
                  <img 
                    src={message.imageData} 
                    alt={message.fileName || 'Uploaded image'}
                    className="max-w-full h-auto rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
                    style={{ maxHeight: '300px', objectFit: 'contain' }}
                    onClick={() => {
                      // Open image in new tab for full view
                      const newWindow = window.open();
                      newWindow.document.write(`
                        <html>
                          <head><title>${message.fileName || 'Image'}</title></head>
                          <body style="margin:0;padding:20px;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                            <img src="${message.imageData}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${message.fileName || 'Image'}" />
                          </body>
                        </html>
                      `);
                    }}
                  />
                  {message.fileSize && (
                    <div className={`absolute bottom-1 right-1 px-2 py-1 rounded text-xs ${
                      isSelfMessage 
                        ? 'bg-black/20 text-white' 
                        : isDark 
                          ? 'bg-black/40 text-white' 
                          : 'bg-white/80 text-gray-700'
                    }`}>
                      {formatFileSize(message.fileSize)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              renderTextWithMentions(message.text)
            )}
          </div>
          
          <div className={`flex items-center justify-between mt-1 ${
            isSelfMessage 
              ? "text-blue-100" 
              : isDark 
                ? "text-gray-400" 
                : "text-gray-500"
          }`}>
            <div className="flex-1">
              {/* Space for future features */}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Message Actions */}
              <MessageActions
                message={message}
                isSelfMessage={isSelfMessage}
                onReply={onReply}
                onEdit={onEdit}
              />
              
              {/* Message Status */}
              {isSelfMessage && (
                <MessageStatus
                  status={message.status || 'sent'}
                  timestamp={message.timestamp}
                />
              )}
              
              {/* Timestamp for non-self messages */}
              {!isSelfMessage && (
                <span className="text-xs">
                  {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }) : new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={handleClickOutside}
          />
          <div 
            className={`fixed z-50 rounded-lg shadow-lg border min-w-[120px] ${
              isDark 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
          >
            <button
              onClick={handleReply}
              className={`w-full px-3 py-2 text-left text-sm transition-colors duration-200 flex items-center space-x-2 rounded-lg ${
                isDark 
                  ? 'text-gray-300 hover:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Reply</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
