import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageReactions({ 
  message, 
  onAddReaction, 
  onRemoveReaction, 
  currentUserId 
}) {
  const { isDark } = useTheme();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiClick = (emoji) => {
    const existingReaction = message.reactions?.find(r => 
      r.emoji === emoji && r.userId === currentUserId
    );

    if (existingReaction) {
      onRemoveReaction(message.id, emoji);
    } else {
      onAddReaction(message.id, emoji);
    }
    setShowEmojiPicker(false);
  };

  const getReactionCounts = () => {
    if (!message.reactions) return {};
    
    const counts = {};
    message.reactions.forEach(reaction => {
      counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
    });
    return counts;
  };

  const hasUserReacted = (emoji) => {
    return message.reactions?.some(r => 
      r.emoji === emoji && r.userId === currentUserId
    );
  };

  const reactionCounts = getReactionCounts();

  return (
    <div className="relative">
      {/* Existing Reactions */}
      {Object.keys(reactionCounts).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 mb-1">
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors duration-200 ${
                hasUserReacted(emoji)
                  ? isDark
                    ? 'bg-blue-900/50 border border-blue-600 text-blue-400'
                    : 'bg-blue-100 border border-blue-300 text-blue-700'
                  : isDark
                    ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Add Reaction Button */}
      <button
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className={`text-xs px-2 py-1 rounded-full transition-colors duration-200 ${
          isDark
            ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
        title="Add reaction"
      >
        😊+
      </button>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowEmojiPicker(false)}
          />
          <div className={`absolute bottom-full mb-2 left-0 z-50 p-2 rounded-lg shadow-lg border ${
            isDark 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex space-x-1">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className={`p-2 rounded-lg text-lg hover:bg-opacity-20 transition-colors duration-200 ${
                    hasUserReacted(emoji)
                      ? 'bg-blue-500 bg-opacity-20'
                      : isDark
                        ? 'hover:bg-gray-700'
                        : 'hover:bg-gray-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
