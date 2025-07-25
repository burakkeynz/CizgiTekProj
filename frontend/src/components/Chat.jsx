import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";
import api from "../api";
import io from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8000";

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

export default function Chat({ currentUser }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [conversations, setConversations] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [socket, setSocket] = useState(null);
  const [typingUserId, setTypingUserId] = useState(null);
  const [sending, setSending] = useState(false);

  const messageEndRef = useRef(null);

  // Socket bağlantısı ve eventler
  useEffect(() => {
    if (!currentUser?.id) return;
    const s = io(SOCKET_URL, { withCredentials: true });
    window.socket = s;
    setSocket(s);

    s.on("connect", () => {
      console.log("Socket Connected! SID:", s.id);
      s.emit("join", { user_id: currentUser.id });
    });

    s.on("receive_message", (data) => {
      console.log(
        "Socket: receive_message",
        data,
        "Current user:",
        currentUser.id
      );
      if (
        selectedChat &&
        data.conversation_id === selectedChat.conversation_id
      ) {
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              m.timestamp === data.timestamp &&
              m.sender_id === data.sender_id &&
              m.content === data.content
          );
          if (exists) return prev;
          return [
            ...prev,
            {
              from_me: data.sender_id === currentUser.id, // !!!!
              sender_id: data.sender_id,
              content: data.content,
              timestamp: data.timestamp,
            },
          ];
        });
      }
    });

    s.on("typing", (data) => {
      if (
        selectedChat &&
        selectedChat.user.id === data.sender_id && // Karşıdaki kişi
        data.sender_id !== currentUser.id &&
        data.conversation_id === selectedChat.conversation_id // Aynı sohbet
      ) {
        setTypingUserId(data.sender_id);
        setTimeout(() => setTypingUserId(null), 1500);
      }
    });
    s.on("user_status_update", (data) => {
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
    });

    return () => s.disconnect();
    // eslint-disable-next-line
  }, [currentUser?.id, selectedChat?.conversation_id]);

  // Sohbetler ve kullanıcılar
  useEffect(() => {
    const fetchData = async () => {
      const convRes = await api.get("/conversations/my");
      setConversations(convRes.data);

      const availRes = await api.get("/users/available");
      setAvailableUsers(availRes.data);
    };
    fetchData();
  }, []);

  // Mesajlar
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
        res.data.map((msg) => ({
          ...msg,
          from_me: msg.sender_id === currentUser.id,
        }))
      );
    };
    fetchMessages();
  }, [selectedChat, currentUser?.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUserId]);

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

  // Mesaj gönderme (optimistik ekleme ve socket ile broadcast)
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setSending(true);
    const content = newMessage.trim();
    const timestamp = new Date().toISOString();

    // Localde hemen göster (optimistik)
    setMessages((prev) => [
      ...prev,
      {
        from_me: true,
        sender_id: currentUser.id,
        content,
        timestamp,
      },
    ]);
    setNewMessage("");

    await api.post(`/conversations/${selectedChat.conversation_id}/messages`, {
      content,
    });

    // Socket ile hem kendine hem karşıya ilet
    if (socket) {
      socket.emit("message", {
        sender_id: currentUser.id,
        receiver_id: selectedChat.user.id,
        content,
        conversation_id: selectedChat.conversation_id,
        timestamp,
      });
    }
    setSending(false);
  };

  // Typing indicator fonksiyonu
  const handleTyping = () => {
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
                  ? `${c.last_message.from_me ? "Sen: " : ""}${
                      c.last_message.content
                    }`
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
              {typingUserId === selectedChat.user.id && (
                <div style={styles.typing}>Yazıyor...</div>
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
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleTyping}
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

const styles = {
  container: {
    display: "flex",
    height: "100vh",
  },
  sidebar: {
    width: 320,
    borderRight: "1px solid #ccc",
    padding: 0,
    overflowY: "auto",
    position: "relative",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 22px 10px 22px",
    fontWeight: 700,
    fontSize: 21,
    position: "relative",
  },
  timestamp: {
    fontSize: 11,
    color: "#ccc",
    marginTop: 6,
    textAlign: "right",
    minWidth: 48,
  },
  typing: {
    color: "#bbb",
    fontSize: 13,
    margin: 8,
    fontStyle: "italic",
    alignSelf: "flex-start",
  },
  plusBtn: {
    fontWeight: 700,
    border: "none",
    borderRadius: "50%",
    width: 30,
    height: 30,
    fontSize: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 2px 8px #0001",
    marginLeft: 6,
    marginTop: 2,
    transition: "background .2s",
  },
  dropdown: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    zIndex: 999,
    borderRadius: 12,
    boxShadow: "0 8px 32px #0003",
    padding: "18px 8px 8px 8px",
    minHeight: 80,
    minWidth: 240,
    animation: "dropdownAnim 0.15s",
  },
  dropdownHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: "0 8px",
  },
  header: {
    marginBottom: 0,
    fontWeight: 700,
    fontSize: 20,
  },
  userItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    cursor: "pointer",
    borderBottom: "1px solid #eee",
    fontSize: 15,
    borderRadius: 8,
    transition: "background .15s",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    overflow: "hidden",
    background: "#ddd",
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
    color: "#555",
    fontSize: 18,
  },
  name: {
    fontWeight: 600,
    fontSize: 15,
  },
  preview: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#fff",
  },
  chatHeader: {
    padding: 16,
    borderBottom: "1px solid #ccc",
    fontWeight: 700,
    fontSize: 18,
  },
  messages: {
    flex: 1,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflowY: "auto",
    background: "#fafafa",
  },
  message: {
    maxWidth: "60%",
    padding: "10px 14px",
    borderRadius: 14,
  },
  inputRow: {
    display: "flex",
    borderTop: "1px solid #ccc",
    padding: 12,
    background: "#f4f4f4",
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 20,
    border: "1px solid #aaa",
    outline: "none",
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: 8,
    padding: "0 20px",
    borderRadius: 20,
    border: "none",
    background: "#4caf50",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
  },
  empty: {
    margin: "auto",
    fontSize: 18,
    color: "#888",
    textAlign: "center",
  },
};
