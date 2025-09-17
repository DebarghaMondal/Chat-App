// Get backend URL from environment variable or fallback to localhost for development
const getBackendUrl = () => {
  // Use environment variable if available (for production)
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  
  // Fallback for development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // Default fallback (shouldn't reach here in normal cases)
  return 'http://localhost:3001';
};

export const API_BASE_URL = getBackendUrl();
export default API_BASE_URL;
