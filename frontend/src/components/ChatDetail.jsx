import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { FiVideo, FiPhone, FiPaperclip } from "react-icons/fi";
import api from "../api";

// Yardımcı fonksiyonlar
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
function UserAvatar({ user }) {
  const name = user?.name || user?.first_name || user?.username || "Bilinmeyen";
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "#344153",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {user?.profile_picture_url ? (
        <img
          src={user.profile_picture_url}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          alt="Avatar"
        />
      ) : (
        <div style={{ fontWeight: "bold", color: "#fff", fontSize: 18 }}>
          {name[0]?.toUpperCase() || "?"}
        </div>
      )}
    </div>
  );
}

export default function ChatDetail() {
  const { currentUser, socket, conversations } = useOutletContext();
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);
  const [typingActiveAt, setTypingActiveAt] = useState(null);
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef();

  const selectedChat = conversations?.find(
    (c) => String(c.conversation_id) === String(conversationId)
  );

  // --- WebRTC: OFFER dinleme test ---
  useEffect(() => {
    if (!socket) return;
    const onOffer = (data) => {
      console.log("[FRONTEND] webrtc_offer EVENT ALINDI:", data);
      alert(
        `[WebRTC] Arama teklifi geldi!\nKimden: ${data.from_user_id}\nTip: ${data.call_type}`
      );
    };
    socket.on("webrtc_offer", onOffer);
    return () => socket.off("webrtc_offer", onOffer);
  }, [socket]);

  // Chat, typing, socket ve mesaj olayları
  useEffect(() => {
    if (!currentUser || !currentUser.id || !conversationId || !selectedChat) {
      navigate("/chat", { replace: true });
      return;
    }
    if (!socket || socket.disconnected) {
      navigate("/chat", { replace: true });
      return;
    }
    const onDisconnect = () => navigate("/chat", { replace: true });
    socket.on("disconnect", onDisconnect);
    return () => socket.off("disconnect", onDisconnect);
  }, [currentUser, conversationId, socket, selectedChat, navigate]);

  useEffect(() => {
    if (!selectedChat) return;
    const fetchMessages = async () => {
      const res = await api.get(`/conversations/${conversationId}/messages`);
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
  }, [conversationId, selectedChat, currentUser?.id]);

  useEffect(() => {
    if (!socket || !currentUser?.id || !selectedChat) return;
    const handleReceiveMessage = (data) => {
      if (data.conversation_id === selectedChat.conversation_id) {
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
        selectedChat.user.id === data.sender_id &&
        data.sender_id !== currentUser.id &&
        data.conversation_id === selectedChat.conversation_id
      ) {
        setTypingUserId(data.sender_id);
        setTypingActiveAt(Date.now());
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("typing", handleTyping);
    };
  }, [socket, currentUser?.id, selectedChat]);

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

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingActiveAt]);

  // ----> WebRTC ARAMA BAŞLAT (Test: signal gönder)
  function handleAudioCall() {
    if (!socket || !currentUser || !selectedChat) return;
    const fakeSDP = "test-sdp-audio-" + Math.random();
    const payload = {
      conversation_id: selectedChat.conversation_id,
      from_user_id: String(currentUser.id),
      to_user_id: String(selectedChat.user.id),
      sdp: fakeSDP,
      call_type: "audio",
    };
    console.log("[FRONTEND] handleAudioCall emit:", payload, "socket:", socket);
    socket.emit("webrtc_offer", payload);
    alert("Sesli arama teklifi gönderildi! (webrtc_offer emit)");
  }
  function handleVideoCall() {
    if (!socket || !currentUser || !selectedChat) return;
    const fakeSDP = "test-sdp-video-" + Math.random();
    const payload = {
      conversation_id: selectedChat.conversation_id,
      from_user_id: String(currentUser.id),
      to_user_id: String(selectedChat.user.id),
      sdp: fakeSDP,
      call_type: "video",
    };
    console.log("[FRONTEND] handleVideoCall emit:", payload, "socket:", socket);
    socket.emit("webrtc_offer", payload);
    alert("Görüntülü arama teklifi gönderildi! (webrtc_offer emit)");
  }

  function handleFileClick() {
    fileInputRef.current?.click();
  }
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    alert(`Dosya seçildi: ${file.name}`);
    // Upload API vs buraya
  }
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
          message_id: tempId,
          optimistic: true,
        },
      ])
    );

    setNewMessage("");

    try {
      await api.post(`/conversations/${conversationId}/messages`, { content });
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.message_id !== tempId));
    }
    setSending(false);
  };
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
  if (!selectedChat) return null;
  const iconBtnStyle = {
    background: "none",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    color: "#5c93f7",
    padding: 7,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginLeft: 6,
    transition: "background .15s",
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: isDark ? "#181a1b" : "#fff",
        minHeight: 0,
      }}
    >
      {/* header */}
      <div
        style={{
          padding: "0 24px",
          borderBottom: "1px solid #22293a",
          background: isDark ? "#202124" : "#fff",
          color: isDark ? "#fff" : "#23272f",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 74,
        }}
      >
        {/* SOL: Avatar, isim, durum */}
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <UserAvatar user={selectedChat.user} />
          <div>
            <div style={{ fontWeight: "600", fontSize: 16 }}>
              {selectedChat.user.first_name ||
                selectedChat.user.username ||
                "Kullanıcı"}
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
              />
              <span style={{ color: "#888" }}>
                {getStatusText(selectedChat.user.status)}
              </span>
            </div>
          </div>
        </div>
        {/* SAĞ: Arama ikonları */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            style={iconBtnStyle}
            title="Sesli Arama"
            onClick={handleAudioCall}
          >
            <FiPhone size={22} />
          </button>
          <button
            style={iconBtnStyle}
            title="Görüntülü Arama"
            onClick={handleVideoCall}
          >
            <FiVideo size={22} />
          </button>
        </div>
      </div>
      {/* messages */}
      <div
        style={{
          flex: 1,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 13,
          overflowY: "auto",
          background: isDark ? "#23272f" : "#fafafa",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              maxWidth: "63%",
              padding: "12px 18px",
              borderRadius: 19,
              fontSize: 15,
              alignSelf: msg.from_me ? "flex-end" : "flex-start",
              background: msg.from_me ? "#4caf50" : isDark ? "#353535" : "#eee",
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
            <div
              style={{
                fontSize: 11,
                color: "#747c8e",
                marginTop: 7,
                textAlign: "right",
                minWidth: 48,
              }}
            >
              {formatDate(msg.timestamp)}
            </div>
          </div>
        ))}
        {typingUserId === selectedChat?.user?.id && typingActiveAt && (
          <div
            style={{
              color: "#8ea0c6",
              fontSize: 20,
              margin: 7,
              fontStyle: "italic",
              alignSelf: "flex-start",
              minHeight: 28,
            }}
          >
            <DotLoader />
          </div>
        )}
        <div ref={messageEndRef} />
      </div>
      {/* input */}
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #23293a",
          padding: 14,
          background: isDark ? "#1d2021" : "#f4f4f4",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* SOL: Ataç ikonu */}
        <button
          style={{
            background: "none",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            color: "#5c93f7",
            padding: 6,
            marginRight: 6,
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Dosya Gönder"
          onClick={handleFileClick}
        >
          <FiPaperclip size={22} />
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
          />
        </button>
        {/* ORTA: input */}
        <input
          style={{
            flex: 1,
            padding: "13px 16px",
            borderRadius: 24,
            border: "1.5px solid #26334b",
            outline: "none",
            fontSize: 15,
            background: isDark ? "#23272f" : "#fff",
            color: isDark ? "#eee" : "#23272f",
            boxShadow: "0 1px 2px #0001",
            marginRight: 2,
          }}
          value={newMessage}
          onChange={handleInputChange}
          placeholder="Mesaj yaz..."
          onKeyUp={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          disabled={sending}
        />
        {/* SAĞ: gönder butonu */}
        <button
          style={{
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
          }}
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? "Gönderiliyor..." : "Gönder"}
        </button>
      </div>
    </div>
  );
}
