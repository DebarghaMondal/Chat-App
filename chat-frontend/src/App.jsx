import { useState } from "react";
import RoomJoin from "./components/RoomJoin";
import ChatRoom from "./components/ChatRoom";
import { v4 as uuidv4 } from "uuid";
import { ThemeProvider } from "./contexts/ThemeContext";

export default function App() {
  const [user, setUser] = useState(() => {
    // Try to restore from localStorage first
    try {
      const saved = localStorage.getItem("chat-user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.username && parsed.roomId) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to restore user from localStorage:", e);
    }

    // Fallback to URL params for shared links
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");
    return roomId ? { id: null, username: "", roomId } : null;
  });

  return (
    <ThemeProvider>
      {/* Agar username empty ya null → show RoomJoin */}
      {!user || user.username === "" ? (
        <RoomJoin
          user={user}
          onJoin={(username, roomId) => {
            const newUser = { id: uuidv4(), username, roomId };
            setUser(newUser);
            // Save to localStorage for persistence
            localStorage.setItem("chat-user", JSON.stringify(newUser));
            // Update URL so that link is same for sharing
            window.history.replaceState({}, "", `?room=${roomId}`);
          }}
        />
      ) : (
        // Agar username set hai → show ChatRoom
        <ChatRoom user={user} onLeave={() => setUser(null)} />
      )}
    </ThemeProvider>
  );
}
