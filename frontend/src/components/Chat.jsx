import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeContext";
import api from "../api";

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
    return ""; // boş array gelirse
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

  const [typingUserId, setTypingUserId] = useState(null);
  const [sending, setSending] = useState(false);

  const messageEndRef = useRef(null);

  useEffect(() => {
    if (!socket || !currentUser?.id) return;

    socket.off("receive_message");
    socket.off("typing");
    socket.off("user_status_update");
    socket.off("connect_error");

    const handleReceiveMessage = (data) => {
      console.log("receive_message EVENTİ GELDİ:", data);
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
        setTimeout(() => setTypingUserId(null), 1500);
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

  useEffect(() => {
    const fetchData = async () => {
      const convRes = await api.get("/conversations/my");
      setConversations(convRes.data);

      const availRes = await api.get("/users/available");
      setAvailableUsers(availRes.data);
    };
    fetchData();
  }, []);

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
      const res = await api.post(
        `/conversations/${selectedChat.conversation_id}/messages`,
        { content }
      );
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.message_id !== tempId));
    }
    setSending(false);
  };

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
                <div style={styles.preview}>
                  {c.last_message
                    ? `${
                        c.last_message.from_me ? "Sen: " : ""
                      }${lastMessagePreview(c.last_message.content)}`
                    : "Henüz mesaj yok"}
                </div>
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
