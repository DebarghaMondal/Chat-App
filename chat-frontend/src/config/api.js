// Auto-detect backend URL based on environment
const getBackendUrl = () => {
  // Check if we're in development (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // For production, construct backend URL based on current domain
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // If frontend is on a subdomain like 'app.example.com', 
  // backend might be on 'api.example.com' or same domain with different port
  if (hostname.includes('netlify.app') || hostname.includes('vercel.app')) {
    // For platforms like Netlify/Vercel, backend is usually on a different service
    // You can customize this based on your deployment setup
    return `${protocol}//api-${hostname}`;
  }
  
  // For same-domain deployments (like Heroku full-stack)
  // Backend and frontend on same domain, different paths or ports
  return `${protocol}//${hostname}`;
};

export const API_BASE_URL = getBackendUrl();
export default API_BASE_URL;
