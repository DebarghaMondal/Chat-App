import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useTheme } from "../contexts/ThemeContext";
import ThemeToggle from "./ThemeToggle";

export default function RoomJoin({ user, onJoin }) {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState(user?.roomId || "");
  const [roomLocked, setRoomLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(false);
  const { isDark } = useTheme();

  // Keep local roomId in sync with parent-provided user.roomId
  useEffect(() => {
    if (user?.roomId && user.roomId !== roomId) {
      setRoomId(user.roomId);
    }
  }, [user?.roomId]);

  // Check lock state from backend whenever roomId changes
  useEffect(() => {
    let aborted = false;
    async function check() {
      if (!roomId) {
        setRoomLocked(false);
        return;
      }
      try {
        setCheckingLock(true);
        const base = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
        const res = await fetch(`${base}/api/rooms/${encodeURIComponent(roomId)}/lock`, { method: 'GET' });
        if (!aborted) {
          if (res.ok) {
            const data = await res.json();
            setRoomLocked(Boolean(data?.locked));
          } else {
            setRoomLocked(false);
          }
        }
      } catch (e) {
        if (!aborted) setRoomLocked(false);
      } finally {
        if (!aborted) setCheckingLock(false);
      }
    }
    check();
    return () => { aborted = true; };
  }, [roomId]);

  // Create Room and copy link
  const createRoom = () => {
    const newRoomId = uuidv4();
    const url = `${window.location.origin}?room=${newRoomId}`;
    navigator.clipboard.writeText(url);
    alert("Chat room created! Link copied. Share with friends.");
    setRoomId(newRoomId);
    // reflect the new room in the URL so the link is consistent
    window.history.replaceState({}, "", `?room=${newRoomId}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && roomId) {
      onJoin(username, roomId);
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-screen px-4 relative overflow-hidden transition-colors duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
        : 'bg-gradient-to-br from-blue-900 via-gray-900 to-purple-900'
    }`}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse ${
          isDark ? 'bg-indigo-400' : 'bg-blue-500'
        }`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000 ${
          isDark ? 'bg-purple-400' : 'bg-purple-500'
        }`}></div>
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000 ${
          isDark ? 'bg-blue-400' : 'bg-indigo-500'
        }`}></div>
      </div>

      <div className={`p-6 sm:p-10 rounded-3xl shadow-2xl w-full max-w-md text-center relative z-10 backdrop-blur-sm transition-colors duration-300 ${
        isDark 
          ? 'bg-gray-800/90 border border-gray-700' 
          : 'bg-white'
      }`}>
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
            ChatConnect
          </h1>
          <h2 className={`text-xl sm:text-2xl font-semibold mb-2 transition-colors duration-300 ${
            isDark ? 'text-gray-200' : 'text-gray-800'
          }`}>
            {roomId ? "Join Chat Room" : "Start a Chat Room"}
          </h2>
          <p className={`text-sm sm:text-base mb-4 transition-colors duration-300 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {roomId ? "Enter your name to join the conversation" : "Connect instantly with friends and colleagues"}
          </p>
          
          {/* Feature highlights */}
          {!roomId && (
            <div className="grid grid-cols-2 gap-4 mt-6 mb-6">
              <div className={`text-center p-3 rounded-xl transition-colors duration-300 ${
                isDark ? 'bg-blue-900/30 border border-blue-800/50' : 'bg-blue-50'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 ${
                  isDark ? 'bg-blue-800/50' : 'bg-blue-100'
                }`}>
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>Secure</p>
              </div>
              <div className={`text-center p-3 rounded-xl transition-colors duration-300 ${
                isDark ? 'bg-green-900/30 border border-green-800/50' : 'bg-green-50'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 ${
                  isDark ? 'bg-green-800/50' : 'bg-green-100'
                }`}>
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>Instant</p>
              </div>
              <div className={`text-center p-3 rounded-xl transition-colors duration-300 ${
                isDark ? 'bg-purple-900/30 border border-purple-800/50' : 'bg-purple-50'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 ${
                  isDark ? 'bg-purple-800/50' : 'bg-purple-100'
                }`}>
                  <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <p className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>Group Chat</p>
              </div>
              <div className={`text-center p-3 rounded-xl transition-colors duration-300 ${
                isDark ? 'bg-orange-900/30 border border-orange-800/50' : 'bg-orange-50'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 ${
                  isDark ? 'bg-orange-800/50' : 'bg-orange-100'
                }`}>
                  <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className={`text-xs font-medium ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>Responsive</p>
              </div>
            </div>
          )}
        </div>

        {!roomId && (
          <div className="mb-6">
            <button
              onClick={createRoom}
              className="w-full bg-blue-600 text-white py-4 sm:py-4 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl active:scale-[0.98] min-h-[48px] touch-manipulation"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
              New Chat Room
            </button>
          </div>
        )}

        {roomId && (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="username" className={`block text-sm font-medium mb-2 text-left transition-colors duration-300 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Your Name
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full px-4 py-3 sm:py-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 text-base sm:text-lg min-h-[48px] touch-manipulation ${
                  isDark 
                    ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' 
                    : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your name"
                required
              />
            </div>

            {roomId && (
              <div>
                <label htmlFor="roomId" className={`block text-sm font-medium mb-2 text-left transition-colors duration-300 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Room ID
                </label>
                <input
                  type="text"
                  id="roomId"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={`w-full px-4 py-3 sm:py-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 text-base sm:text-lg min-h-[48px] touch-manipulation ${
                    isDark 
                      ? 'border-gray-600 bg-gray-600 text-gray-300' 
                      : 'border-gray-300 bg-gray-50 text-gray-700'
                  }`}
                  placeholder="Room ID"
                  required
                  readOnly
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!username || !roomId || roomLocked || checkingLock}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 sm:py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl active:scale-[0.98] min-h-[48px] touch-manipulation"
            >
              {roomId ? (roomLocked ? "Room Locked" : "Join Room") : "Create Room"}
            </button>
          </form>
        )}

        {roomId && (
          <div className={`mt-6 pt-6 border-t transition-colors duration-300 ${
            isDark ? 'border-gray-600' : 'border-gray-200'
          }`}>
            {roomLocked && (
              <div className={`mb-3 text-sm flex items-center gap-2 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 8V7a5 5 0 1110 0v1h1a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1h1zm2-1a3 3 0 116 0v1H7V7z" clipRule="evenodd"/></svg>
                <span>This room is currently locked. Ask the host to unlock it to join.</span>
              </div>
            )}
            <p className={`text-xs mb-2 transition-colors duration-300 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>Or create a new chat room</p>
            <button
              onClick={() => {
                setRoomId("");
                window.history.replaceState({}, "", "/");
              }}
              className={`text-sm font-medium transition-colors duration-300 ${
                isDark 
                  ? 'text-blue-400 hover:text-blue-300' 
                  : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              Start new chat room
            </button>
          </div>
        )}

        {/* Developer Credit */}
        <div className={`mt-8 pt-4 border-t transition-colors duration-300 ${
          isDark ? 'border-gray-600' : 'border-gray-100'
        }`}>
          <p className={`text-xs flex items-center justify-center gap-1 transition-colors duration-300 ${
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
