import { useEffect, useMemo, useRef, useState } from "react";

/**
 * usePresence: lightweight presence using BroadcastChannel (same-origin tabs).
 * - Announces join/leave and heartbeats.
 * - Tracks online users in memory; no backend required.
 * - Works across tabs/windows of the same origin.
 */
export default function usePresence(currentUser) {
  const [users, setUsers] = useState(() => (currentUser ? { [currentUser.id || "self"]: currentUser } : {}));
  const channelRef = useRef(null);
  const heartbeatRef = useRef(null);
  const id = currentUser?.id || "self";

  // Safely create a channel if available
  const createChannel = () => {
    try {
      if ("BroadcastChannel" in window) {
        return new BroadcastChannel("chat-presence");
      }
    } catch (_) {}
    return null;
  };

  useEffect(() => {
    if (!currentUser) return;

    const channel = createChannel();
    channelRef.current = channel;

    const post = (msg) => channel && channel.postMessage(msg);

    const handleMessage = (e) => {
      const msg = e?.data;
      if (!msg || !msg.type) return;
      if (msg.user?.id === id) return; // ignore own events

      if (msg.type === "join" || msg.type === "heartbeat") {
        setUsers((prev) => ({ ...prev, [msg.user.id]: msg.user }));
      } else if (msg.type === "leave") {
        setUsers((prev) => {
          const copy = { ...prev };
          delete copy[msg.user.id];
          return copy;
        });
      }
    };

    if (channel) channel.addEventListener("message", handleMessage);

    // Announce join and start heartbeats
    post({ type: "join", user: currentUser });
    heartbeatRef.current = setInterval(() => {
      post({ type: "heartbeat", user: currentUser });
    }, 10000);

    // On unload, announce leave
    const onUnload = () => post({ type: "leave", user: currentUser });
    window.addEventListener("beforeunload", onUnload);

    // Ensure we include ourselves locally
    setUsers((prev) => ({ ...prev, [id]: currentUser }));

    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (channel) {
        channel.removeEventListener("message", handleMessage);
        try { channel.close(); } catch (_) {}
      }
    };
  }, [id, currentUser?.id, currentUser?.username, currentUser?.roomId]);

  // Only show users for the same room
  const roomUsers = useMemo(() => {
    const list = Object.values(users).filter((u) => u && u.roomId === currentUser?.roomId);
    // Deduplicate by id (last write wins)
    const map = new Map(list.map((u) => [u.id || "self", u]));
    return Array.from(map.values());
  }, [users, currentUser?.roomId]);

  return roomUsers;
}
