import { useState, useRef, useCallback } from 'react';

export default function useMentions(users, currentUser) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ bottom: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const inputRef = useRef(null);

  // Parse mentions from text
  const parseMentions = useCallback((text) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const username = match[1];
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (user) {
        mentions.push({
          username,
          userId: user.id,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    return mentions;
  }, [users]);

  // Handle input change for mention detection
  const handleInputChange = useCallback((e, setText) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setText(value);

    // Check for @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || lastAtIndex === 0) {
        const query = textBeforeCursor.substring(lastAtIndex + 1);
        
        // Only show if query doesn't contain spaces (incomplete mention)
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setShowAutocomplete(true);
          
          // Calculate position for autocomplete
          if (inputRef.current) {
            const inputRect = inputRef.current.getBoundingClientRect();
            setMentionPosition({
              bottom: window.innerHeight - inputRect.top + 10,
              left: inputRect.left + 10
            });
          }
          return;
        }
      }
    }
    
    // Hide autocomplete if no valid mention context
    setShowAutocomplete(false);
  }, []);

  // Handle mention selection
  const handleMentionSelect = useCallback((user, text, setText) => {
    if (mentionStartIndex === -1 || !inputRef.current) return;

    const beforeMention = text.substring(0, mentionStartIndex);
    const afterCursor = text.substring(inputRef.current.selectionStart);
    const newText = `${beforeMention}@${user.username} ${afterCursor}`;
    
    setText(newText);
    setShowAutocomplete(false);
    
    // Set cursor position after mention
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = mentionStartIndex + user.username.length + 2;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }
    }, 0);
  }, [mentionStartIndex]);

  // Close autocomplete
  const closeMentionAutocomplete = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  // Render text with highlighted mentions
  const renderTextWithMentions = useCallback((text, className = '', isSelfMessage = false) => {
    const mentions = parseMentions(text);
    
    if (mentions.length === 0) {
      return <span className={className}>{text}</span>;
    }

    const parts = [];
    let lastIndex = 0;

    mentions.forEach((mention, index) => {
      // Add text before mention
      if (mention.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {text.substring(lastIndex, mention.start)}
          </span>
        );
      }

      // Add mention with highlighting
      const isSelfMention = mention.username.toLowerCase() === currentUser?.username?.toLowerCase();
      
      let mentionClass;
      if (isSelfMessage) {
        // For messages sent by current user (blue background)
        mentionClass = isSelfMention 
          ? 'text-yellow-300 bg-white/20 px-1 rounded font-bold' 
          : 'text-white bg-white/20 px-1 rounded font-bold';
      } else {
        // For messages from others (white background)
        mentionClass = isSelfMention 
          ? 'text-indigo-600 bg-indigo-100 px-1 rounded font-bold' 
          : 'text-blue-600 font-bold';
      }
      
      parts.push(
        <span
          key={`mention-${index}`}
          className={mentionClass}
          title={`Mentioned: ${mention.username}`}
        >
          @{mention.username}
        </span>
      );

      lastIndex = mention.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key="text-end">
          {text.substring(lastIndex)}
        </span>
      );
    }

    return <span className={className}>{parts}</span>;
  }, [parseMentions, currentUser]);

  // Check if message mentions current user
  const isMentioned = useCallback((text) => {
    if (!currentUser?.username) return false;
    const mentions = parseMentions(text);
    return mentions.some(mention => 
      mention.username.toLowerCase() === currentUser.username.toLowerCase()
    );
  }, [parseMentions, currentUser]);

  return {
    showAutocomplete,
    mentionQuery,
    mentionPosition,
    inputRef,
    handleInputChange,
    handleMentionSelect,
    closeMentionAutocomplete,
    renderTextWithMentions,
    parseMentions,
    isMentioned
  };
}
