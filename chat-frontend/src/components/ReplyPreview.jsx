import { useTheme } from "../contexts/ThemeContext";

export default function ReplyPreview({ message, onCancel }) {
  const { isDark } = useTheme();

  if (!message) return null;

  return (
    <div className={`border-l-4 border-blue-500 px-3 py-2 mb-2 rounded-r-lg transition-colors duration-300 ${
      isDark 
        ? 'bg-gray-700/50 border-gray-600' 
        : 'bg-gray-100 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium mb-1 ${
            isDark ? 'text-blue-400' : 'text-blue-600'
          }`}>
            Replying to {message.username}
          </div>
          <div className={`text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {message.isImage && message.imageData ? (
              <div className="flex items-center space-x-2">
                <img 
                  src={message.imageData} 
                  alt="Reply preview"
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
                <span className="truncate">{message.text}</span>
              </div>
            ) : (
              <span className="truncate">{message.text}</span>
            )}
          </div>
        </div>
        <button
          onClick={onCancel}
          className={`ml-2 p-1 rounded-full transition-colors duration-200 ${
            isDark 
              ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-300' 
              : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
          }`}
          aria-label="Cancel reply"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
