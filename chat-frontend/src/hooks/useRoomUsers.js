import { useState, useEffect } from 'react';

export default function useRoomUsers(socket, user) {
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!socket || !user) {
      setUsers([]);
      return;
    }

    // Socket event handlers
    const handleJoinedRoom = (data) => {
      // User successfully joined, they should be in the users list
      console.log('Successfully joined room:', data);
    };

    const handleUserJoined = (data) => {
      const { user: newUser } = data;
      setUsers(prev => {
        // Avoid duplicates
        if (prev.some(u => u.id === newUser.id)) {
          return prev;
        }
        return [...prev, newUser];
      });
    };

    const handleUserLeft = (data) => {
      const { user: leftUser } = data;
      setUsers(prev => prev.filter(u => u.id !== leftUser.id));
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(leftUser.id);
        return newSet;
      });
    };

    const handleRoomUsersUpdated = (data) => {
      const { users: updatedUsers } = data;
      setUsers(updatedUsers || []);
    };

    const handleUserTyping = (data) => {
      const { userId } = data;
      setTypingUsers(prev => new Set([...prev, userId]));
    };

    const handleUserStoppedTyping = (data) => {
      const { userId } = data;
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    // Register event listeners
    socket.on('joined-room', handleJoinedRoom);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('room-users-updated', handleRoomUsersUpdated);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stopped-typing', handleUserStoppedTyping);

    // Cleanup
    return () => {
      socket.off('joined-room', handleJoinedRoom);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('room-users-updated', handleRoomUsersUpdated);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stopped-typing', handleUserStoppedTyping);
    };
  }, [socket, user?.id]);

  // Get users who are currently typing (excluding current user)
  const getTypingUsers = () => {
    return users.filter(u => 
      typingUsers.has(u.id) && u.id !== user?.id
    );
  };

  return {
    users,
    typingUsers: getTypingUsers(),
    userCount: users.length
  };
}
