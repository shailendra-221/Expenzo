import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api, { SOCKET_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ChatBox({ expenseId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Load history
    api.get(`/expenses/${expenseId}/messages`).then((res) => setMessages(res.data));

    // Connect socket
    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.emit('join_expense', { expenseId: Number(expenseId) });

    socket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [expenseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !socketRef.current) return;
    socketRef.current.emit('send_message', {
      expenseId: Number(expenseId),
      userId: user.id,
      message: text.trim(),
    });
    setText('');
  };

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.user_id === user.id ? 'mine' : ''}`}>
            <div className="meta">
              {m.user_id !== user.id && <span>{m.user_name} · </span>}
              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {m.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={sendMessage}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
        />
        <button className="btn" type="submit">Send</button>
      </form>
    </div>
  );
}
