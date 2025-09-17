import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

export default function MessageActions({ 
  message, 
  isSelfMessage, 
  onReply, 
  onEdit
}) {
  const { isDark } = useTheme();
  const [showActions, setShowActions] = useState(false);

  const actions = [
    {
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
      label: "Reply",
      onClick: () => {
        onReply(message);
        setShowActions(false);
      }
    },
    {
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      ),
      label: "Edit",
      onClick: () => {
        onEdit(message);
        setShowActions(false);
      },
      show: isSelfMessage
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setShowActions(!showActions)}
        className={`opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all duration-200 ${
          isDark
            ? 'hover:bg-gray-600 text-gray-400'
            : 'hover:bg-gray-200 text-gray-500'
        }`}
        title="Message actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
        </svg>
      </button>

      {showActions && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowActions(false)}
          />
          <div className={`absolute ${isSelfMessage ? 'right-0' : 'left-0'} top-full mt-1 z-50 min-w-[140px] rounded-lg shadow-lg border ${
            isDark 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}>
            {actions.filter(action => action.show !== false).map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`w-full px-3 py-2 text-left text-sm transition-colors duration-200 flex items-center space-x-2 first:rounded-t-lg last:rounded-b-lg ${
                  action.className || (isDark 
                    ? 'text-gray-300 hover:bg-gray-700' 
                    : 'text-gray-700 hover:bg-gray-50')
                }`}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
