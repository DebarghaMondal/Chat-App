import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function MentionAutocomplete({ 
  users, 
  isVisible, 
  onSelect, 
  onClose, 
  position,
  query 
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);
  const { isDark } = useTheme();

  // Filter users based on query
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filteredUsers.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isVisible || filteredUsers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, filteredUsers, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && isVisible) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex, isVisible]);

  if (!isVisible || filteredUsers.length === 0) {
    return null;
  }

  return (
    <div 
      className={`absolute z-50 border rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-48 transition-colors duration-300 ${
        isDark 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-white border-gray-200'
      }`}
      style={{
        bottom: position.bottom,
        left: position.left,
      }}
    >
      <div className={`p-2 text-xs border-b transition-colors duration-300 ${
        isDark 
          ? 'text-gray-400 border-gray-600' 
          : 'text-gray-500 border-gray-100'
      }`}>
        Mention someone
      </div>
      <ul ref={listRef} className="py-1">
        {filteredUsers.map((user, index) => (
          <li
            key={user.id}
            className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors duration-200 ${
              index === selectedIndex 
                ? isDark
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-indigo-50 text-indigo-700'
                : isDark
                  ? 'hover:bg-gray-700 text-gray-200'
                  : 'hover:bg-gray-50 text-gray-900'
            }`}
            onClick={() => onSelect(user)}
          >
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium">{user.username}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
