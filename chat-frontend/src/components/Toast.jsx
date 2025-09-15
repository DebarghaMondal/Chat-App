import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function Toast({ message, type = 'info', isVisible, onClose, duration = 3000 }) {
  const { isDark } = useTheme();

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return isDark 
          ? 'bg-green-600 text-white border border-green-500' 
          : 'bg-green-500 text-white';
      case 'error':
        return isDark 
          ? 'bg-red-600 text-white border border-red-500' 
          : 'bg-red-500 text-white';
      case 'warning':
        return isDark 
          ? 'bg-yellow-600 text-white border border-yellow-500' 
          : 'bg-yellow-500 text-white';
      default:
        return isDark 
          ? 'bg-blue-600 text-white border border-blue-500' 
          : 'bg-blue-500 text-white';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px] transition-colors duration-300 ${getTypeStyles()}`}>
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
