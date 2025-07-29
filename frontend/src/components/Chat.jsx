import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";
import api from "../api";

//Yazıyor... kısmı için DotLoader
function DotLoader() {
  return (
    <span style={{ display: "inline-block", minWidth: 30 }}>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <style>
        {`
          .dot { animation: blink 1.4s infinite both; font-size: 20px; color: #bbb;}
          .dot:nth-child(2) { animation-delay: .2s; }
          .dot:nth-child(3) { animation-delay: .4s; }
          @keyframes blink { 0%{opacity:.1;} 20%{opacity:1;} 100%{opacity:.1;} }
        `}
      </style>
    </span>
  );
}

//Yardımcı fonks.
function getUserName(user) {
  if (!user) return "Bilinmeyen Kullanıcı";
  if (user.name) return user.name;
  if (user.first_name && user.last_name)
    return user.first_name + " " + user.last_name;
  if (user.first_name) return user.first_name;
  if (user.username) return user.username;
  return "Bilinmeyen Kullanıcı";
}

function getStatusText(status) {
  switch (status) {
    case "online":
      return "Çevrimiçi";
    case "offline":
      return "Çevrimdışı";
    case "busy":
      return "Meşgul";
    case "in_call":
      return "Aramada";
    default:
      return "Bilinmiyor";
  }
}

function lastMessagePreview(msg) {
  if (!msg) return "";
  if (typeof msg === "string") return msg.slice(0, 40);
  if (Array.isArray(msg)) {
    if (msg.length > 0) {
      const first = msg[0];
      if (typeof first === "string") return first.slice(0, 40);
      if (typeof first === "object" && first !== null) {
        if ("text" in first) return String(first.text).slice(0, 40);
        if ("message" in first) return String(first.message).slice(0, 40);
        return JSON.stringify(first).slice(0, 40);
      }
    }
    return "";
  }
  if (typeof msg === "object" && msg !== null) {
    if ("text" in msg) return String(msg.text).slice(0, 40);
    if ("message" in msg) return String(msg.message).slice(0, 40);
    return JSON.stringify(msg).slice(0, 40);
  }
  return String(msg).slice(0, 40);
}

function getStatusColor(status) {
  switch (status) {
    case "online":
      return "#4caf50";
    case "offline":
      return "#9e9e9e";
    case "busy":
      return "#f39c12";
    case "in_call":
      return "#f44336";
    default:
      return "#bbb";
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function addUniqueMessages(prev, newMsgs) {
  const byId = {};
  prev.forEach((m) => {
    if (m.message_id) byId[m.message_id] = m;
  });
  newMsgs.forEach((m) => {
    if (m.message_id) byId[m.message_id] = m;
  });
  return Object.values(byId).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
}

function UserAvatar({ user }) {
  const name = getUserName(user);
  return (
    <div style={styles.avatar}>
      {user?.profile_picture_url ? (
        <img
          src={user.profile_picture_url}
          style={styles.avatarImg}
          alt="Avatar"
        />
      ) : (
        <div style={styles.initial}>{name[0]?.toUpperCase() || "?"}</div>
      )}
    </div>
  );
}

export default function Chat({ currentUser, socket }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [conversations, setConversations] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  //Yazıyor... animasyonu için state
  const [typingUserId, setTypingUserId] = useState(null);
  const [typingActiveAt, setTypingActiveAt] = useState(null);
  const typingTimeoutRef = useRef(null);

  const [sending, setSending] = useState(false);
  const messageEndRef = useRef(null);

  //socket events
  useEffect(() => {
    if (!socket || !currentUser?.id) return;

    socket.off("receive_message");
    socket.off("typing");
    socket.off("user_status_update");
    socket.off("connect_error");

    const handleReceiveMessage = (data) => {
      if (
        selectedChat &&
        data.conversation_id === selectedChat.conversation_id
      ) {
        setMessages((prev) => {
          const filtered = prev.filter(
            (m) =>
              !(
                m.optimistic &&
                m.content === data.content &&
                m.sender_id === data.sender_id &&
                Math.abs(new Date(m.timestamp) - new Date(data.timestamp)) <
                  2000
              )
          );
          return addUniqueMessages(filtered, [
            {
              from_me: data.sender_id === currentUser.id,
              sender_id: data.sender_id,
              content: data.content,
              timestamp: data.timestamp,
              message_id: data.message_id,
            },
          ]);
        });
      }
    };

    const handleTyping = (data) => {
      if (
        selectedChat &&
        selectedChat.user.id === data.sender_id &&
        data.sender_id !== currentUser.id &&
        data.conversation_id === selectedChat.conversation_id
      ) {
        setTypingUserId(data.sender_id);
        setTypingActiveAt(Date.now()); // Her typing eventinde güncelle
      }
    };

    const handleUserStatusUpdate = (data) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.user.id === data.user_id
            ? { ...c, user: { ...c.user, status: data.status } }
            : c
        )
      );
      setAvailableUsers((prev) =>
        prev.map((u) =>
          u.id === data.user_id ? { ...u, status: data.status } : u
        )
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("typing", handleTyping);
    socket.on("user_status_update", handleUserStatusUpdate);
    socket.on("connect_error", (err) => {
      console.error("[Socket] connect_error:", err);
    });

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("typing", handleTyping);
      socket.off("user_status_update", handleUserStatusUpdate);
      socket.off("connect_error");
    };
  }, [socket, currentUser?.id, selectedChat?.conversation_id]);

  //Yazıyor debounce kısmı
  useEffect(() => {
    if (typingUserId === selectedChat?.user?.id && typingActiveAt) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUserId(null);
        setTypingActiveAt(null);
      }, 1500);
    }
    return () =>
      typingTimeoutRef.current && clearTimeout(typingTimeoutRef.current);
  }, [typingUserId, typingActiveAt, selectedChat?.user?.id]);

  //Sohbetler ve kullanıcılar yükleniyor
  useEffect(() => {
    const fetchData = async () => {
      const convRes = await api.get("/conversations/my");
      setConversations(convRes.data);
      const availRes = await api.get("/users/available");
      setAvailableUsers(availRes.data);
    };
    fetchData();
  }, []);

  //Seçilen sohbet değişince mesajları getir
  useEffect(() => {
    if (!selectedChat || !selectedChat.conversation_id) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      const res = await api.get(
        `/conversations/${selectedChat.conversation_id}/messages`
      );
      setMessages(
        addUniqueMessages(
          [],
          (res.data || []).map((msg) => ({
            ...msg,
            from_me: msg.sender_id === currentUser.id,
            message_id: msg.id,
          }))
        )
      );
    };
    fetchMessages();
  }, [selectedChat, currentUser?.id]);

  //Scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingActiveAt]);

  //Kullanıcı seçince yeni sohbet açar
  const handleUserSelect = async (user) => {
    setShowDropdown(false);
    setMessages([]);
    const existing = conversations.find((c) => c.user?.id === user.id);
    if (existing) {
      setSelectedChat(existing);
      return;
    }
    setSelectedChat({ user, conversation_id: null, loading: true });
    const res = await api.post("/conversations/start_conversation", {
      receiver_id: user.id,
    });
    setSelectedChat({
      user,
      conversation_id: res.data.conversation_id,
      loading: false,
    });
    setConversations((prev) => [
      ...prev,
      { user, conversation_id: res.data.conversation_id, last_message: null },
    ]);
  };

  //MEsaj gönderme
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setSending(true);
    const content = newMessage.trim();
    const tempId = "tmp-" + Date.now();

    setMessages((prev) =>
      addUniqueMessages(prev, [
        {
          from_me: true,
          sender_id: currentUser.id,
          content,
          timestamp: new Date().toISOString(),
          message_id: tempId, // Geçici id
          optimistic: true,
        },
      ])
    );

    setNewMessage("");

    try {
      await api.post(
        `/conversations/${selectedChat.conversation_id}/messages`,
        { content }
      );
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.message_id !== tempId));
    }
    setSending(false);
  };

  // Mesaj güncelleme ve typing emit
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (socket && selectedChat) {
      socket.emit("typing", {
        sender_id: currentUser.id,
        receiver_id: selectedChat.user.id,
        conversation_id: selectedChat.conversation_id,
      });
    }
  };

  return (
    <div style={{ ...styles.container, background: isDark ? "#222" : "#fff" }}>
      {/* sidebar */}
      <div
        style={{
          ...styles.sidebar,
          background: isDark ? "#202124" : "#f9f9f9",
          color: isDark ? "#eee" : "#23272f",
        }}
      >
        <div style={styles.sidebarHeader}>
          <span style={styles.header}>Sohbetler</span>
          <button
            style={{
              ...styles.plusBtn,
              background: isDark ? "#5c93f7" : "#4285f4",
              color: "#fff",
            }}
            onClick={() => setShowDropdown((v) => !v)}
            title="Yeni Sohbet Başlat"
          >
            +
          </button>
        </div>
        {conversations.length === 0 && (
          <div style={{ ...styles.empty, color: isDark ? "#555" : "#bbb" }}>
            Henüz sohbet yok
          </div>
        )}
        {conversations.map((c) => (
          <div
            key={c.user?.id}
            style={{
              ...styles.userItem,
              background:
                selectedChat?.user?.id === c.user?.id
                  ? isDark
                    ? "#333"
                    : "#eef"
                  : "transparent",
              color: isDark ? "#eee" : "#23272f",
            }}
            onClick={() => handleUserSelect(c.user)}
          >
            <UserAvatar user={c.user} />
            <div>
              <div style={styles.name}>{getUserName(c.user)}</div>
              <div style={styles.preview}>
                {c.last_message
                  ? `${
                      c.last_message.from_me ? "Sen: " : ""
                    }${lastMessagePreview(c.last_message.content)}`
                  : "Henüz mesaj yok"}
              </div>
            </div>
          </div>
        ))}
        {showDropdown && (
          <div
            style={{
              ...styles.dropdown,
              background: isDark ? "#28292b" : "#fff",
              color: isDark ? "#fff" : "#23272f",
              boxShadow: isDark ? "0 6px 24px #0004" : "0 6px 24px #0002",
            }}
          >
            <div style={styles.dropdownHeader}>
              <span style={{ fontWeight: 600 }}>Kişi Seçin</span>
              <span
                onClick={() => setShowDropdown(false)}
                style={{ cursor: "pointer", fontSize: 18, padding: 3 }}
              >
                ✕
              </span>
            </div>
            {availableUsers.length === 0 && (
              <div style={{ padding: 24, color: "#bbb", textAlign: "center" }}>
                Kullanıcı yok
              </div>
            )}
            {availableUsers.map((u) => (
              <div
                key={u.id}
                style={styles.userItem}
                onClick={() => handleUserSelect(u)}
              >
                <UserAvatar user={u} />
                <div>{getUserName(u)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* chat alanı */}
      <div
        style={{
          ...styles.chatArea,
          background: isDark ? "#181a1b" : "#fff",
        }}
      >
        {selectedChat ? (
          <>
            <div
              style={{
                ...styles.chatHeader,
                background: isDark ? "#202124" : "#fff",
                color: isDark ? "#fff" : "#23272f",
                display: "flex",
                alignItems: "center",
              }}
            >
              <UserAvatar user={selectedChat.user} />
              <div style={{ marginLeft: 12 }}>
                <div style={{ fontWeight: "600", fontSize: 16 }}>
                  {getUserName(selectedChat.user)}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: getStatusColor(selectedChat.user.status),
                      marginRight: 6,
                    }}
                  ></div>
                  <span style={{ color: "#888" }}>
                    {getStatusText(selectedChat.user.status)}
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                ...styles.messages,
                background: isDark ? "#23272f" : "#fafafa",
              }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.message,
                    alignSelf: msg.from_me ? "flex-end" : "flex-start",
                    background: msg.from_me
                      ? "#4caf50"
                      : isDark
                      ? "#353535"
                      : "#eee",
                    color: msg.from_me ? "#fff" : isDark ? "#eee" : "#000",
                    borderTopLeftRadius: msg.from_me ? 16 : 4,
                    borderTopRightRadius: msg.from_me ? 4 : 16,
                    marginLeft: msg.from_me ? "40%" : 0,
                    marginRight: msg.from_me ? 0 : "40%",
                    boxShadow: "0 1px 6px #0001",
                    position: "relative",
                  }}
                >
                  {msg.content}
                  <div style={styles.timestamp}>
                    {formatDate(msg.timestamp)}
                  </div>
                </div>
              ))}
              {typingUserId === selectedChat?.user?.id && typingActiveAt && (
                <div style={styles.typing}>
                  <DotLoader />
                </div>
              )}

              <div ref={messageEndRef} />
            </div>
            <div
              style={{
                ...styles.inputRow,
                background: isDark ? "#1d2021" : "#f4f4f4",
              }}
            >
              <input
                style={{
                  ...styles.input,
                  background: isDark ? "#23272f" : "#fff",
                  color: isDark ? "#eee" : "#23272f",
                }}
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Mesaj yaz..."
                onKeyUp={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                disabled={!selectedChat || selectedChat.loading || sending}
              />
              <button
                style={styles.sendBtn}
                onClick={sendMessage}
                disabled={
                  !selectedChat ||
                  selectedChat.loading ||
                  !newMessage.trim() ||
                  sending
                }
              >
                {sending ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </>
        ) : (
          <div style={styles.empty}>Sohbet seçin veya yeni başlatın</div>
        )}
      </div>
    </div>
  );
}

//styles
const styles = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    background: "#10131a",
  },
  sidebar: {
    width: 320,
    borderRight: "1.5px solid #242a35",
    background: "#161b22",
    color: "#eceef2",
    padding: 0,
    overflowY: "auto",
    position: "relative",
    boxShadow: "2px 0 10px #0002",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 22px 12px 22px",
    fontWeight: 700,
    fontSize: 22,
    borderBottom: "1px solid #23272f",
    background: "#161b22",
  },
  timestamp: {
    fontSize: 11,
    color: "#747c8e",
    marginTop: 7,
    textAlign: "right",
    minWidth: 48,
  },
  typing: {
    color: "#8ea0c6",
    fontSize: 20,
    margin: 7,
    fontStyle: "italic",
    alignSelf: "flex-start",
    minHeight: 28,
  },
  plusBtn: {
    fontWeight: 700,
    border: "none",
    borderRadius: "50%",
    width: 36,
    height: 36,
    fontSize: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginLeft: 6,
    marginTop: 2,
    background: "linear-gradient(135deg, #5c93f7 0%, #4285f4 100%)",
    color: "#fff",
    boxShadow: "0 2px 12px #3571c555, 0 1px 4px #0001",
    transition: "background .17s, box-shadow .17s",
  },
  dropdown: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 999,
    borderRadius: 14,
    boxShadow: "0 8px 32px #0006",
    padding: "16px 10px 10px 10px",
    minHeight: 85,
    minWidth: 240,
    background: "#232b3b",
    color: "#eee",
    animation: "dropdownAnim 0.13s",
  },
  dropdownHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: "0 8px",
    color: "#cfd6ea",
    fontWeight: 600,
  },
  header: {
    marginBottom: 0,
    fontWeight: 700,
    fontSize: 21,
    color: "#e8ecf4",
  },
  userItem: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "13px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #202534",
    fontSize: 16,
    borderRadius: 10,
    transition: "background .17s",
    background: "transparent",
    marginBottom: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    overflow: "hidden",
    background: "#344153",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  initial: {
    fontWeight: "bold",
    color: "#fff",
    fontSize: 18,
    letterSpacing: 1,
  },
  name: {
    fontWeight: 600,
    fontSize: 16,
    color: "#e7ecfb",
  },
  preview: {
    fontSize: 13,
    color: "#8ea0c6",
    marginTop: 2,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
    maxWidth: 175,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#131722",
  },
  chatHeader: {
    padding: 19,
    borderBottom: "1px solid #22293a",
    fontWeight: 700,
    fontSize: 18,
    background: "#181b26",
    color: "#f4f8fd",
  },
  messages: {
    flex: 1,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 13,
    overflowY: "auto",
    background: "#181b26",
  },
  message: {
    maxWidth: "63%",
    padding: "12px 18px",
    borderRadius: 19,
    fontSize: 15,
    wordBreak: "break-word",
    boxShadow: "0 2px 12px #0002",
    background: "#26334b",
    color: "#e8eef7",
  },
  inputRow: {
    display: "flex",
    borderTop: "1px solid #23293a",
    padding: 14,
    background: "#161b22",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    padding: "13px 16px",
    borderRadius: 24,
    border: "1.5px solid #26334b",
    outline: "none",
    fontSize: 15,
    background: "#1d2230",
    color: "#e8eef7",
    boxShadow: "0 1px 2px #0001",
    marginRight: 2,
  },
  sendBtn: {
    marginLeft: 8,
    padding: "0 28px",
    borderRadius: 23,
    border: "none",
    background: "linear-gradient(135deg, #5c93f7 0%, #4285f4 100%)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
    height: 38,
    boxShadow: "0 1px 10px #2862c166",
    transition: "background .19s, box-shadow .19s",
  },
  empty: {
    margin: "auto",
    fontSize: 19,
    color: "#aaa",
    textAlign: "center",
  },
};
