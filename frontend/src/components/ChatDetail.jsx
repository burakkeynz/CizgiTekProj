import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { FiVideo, FiPhone, FiPaperclip } from "react-icons/fi";
import { useSelector, useDispatch } from "react-redux";
import { setMessages, addMessage, setConversations } from "../store/chatSlice";
import { startCall } from "../store/callSlice";
import { useLanguage } from "./LanguageContext";
import { toast } from "react-toastify";
import { useCallback } from "react";

import api from "../api";

// Status metni
function getStatusText(status, inCall, t) {
  if (inCall) return t("In Call", "Aramada");
  switch (status) {
    case "online":
      return t("Online", "Çevrimiçi");
    case "offline":
      return t("Offline", "Çevrimdışı");
    case "busy":
      return t("Busy", "Meşgul");
    case "in_call":
      return t("In Call", "Aramada");
    default:
      return t("Unknown", "Bilinmiyor");
  }
}
function getStatusColor(status, inCall) {
  if (inCall) return "#f44336";
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
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const { conversationId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const EMPTY_ARRAY = [];
  const selectMessages = (state, conversationId) =>
    state.chat.messages[conversationId] || EMPTY_ARRAY;
  const messages = useSelector((state) =>
    selectMessages(state, conversationId)
  );
  const callState = useSelector((state) => state.call);
  const { inCall, peerUser } = callState;
  const messageEndRef = useRef(null);
  const fileInputRef = useRef();
  const [newMessage, setNewMessage] = useState("");
  const [headerVisible, setHeaderVisible] = useState(!inCall);

  useEffect(() => {
    if (!inCall) {
      const timeout = setTimeout(() => setHeaderVisible(true), 800);
      return () => clearTimeout(timeout);
    } else {
      setHeaderVisible(false);
    }
  }, [inCall]);

  const selectedChat = conversations?.find(
    (c) => String(c.conversation_id) === String(conversationId)
  );

  useEffect(() => {
    if (!selectedChat && conversationId) {
      api.get("/conversations/my").then((res) => {
        setConversations(res.data);
      });
    }
  }, [selectedChat, conversationId, setConversations]);

  //Unread-->Read geçişini yapacağım nokta
  useEffect(() => {
    if (!messages || !currentUser?.id || !selectedChat) return;

    const unreadMsgIds = messages
      .filter((msg) => !msg.from_me)
      .map((msg) => msg.message_id || msg.id);

    if (unreadMsgIds.length > 0 && selectedChat.unread_count > 0) {
      const prevConversations = [...conversations];

      setConversations(
        conversations.map((c) =>
          c.conversation_id === selectedChat.conversation_id
            ? { ...c, unread_count: 0 }
            : c
        )
      );

      api
        .post("/conversations/mark_as_read", { message_ids: unreadMsgIds })
        .catch(() => {
          setConversations(prevConversations);
          toast.error("Mesajlar okunmuş olarak işaretlenemedi.");
        });
    }
  }, [
    messages,
    currentUser?.id,
    selectedChat,
    conversations,
    setConversations,
  ]);

  useEffect(() => {
    if (!currentUser || !currentUser.id || !conversationId) {
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
  }, [currentUser, conversationId, socket, navigate]);

  useEffect(() => {
    if (!selectedChat) return;
    const fetchMessages = async () => {
      const res = await api.get(`/conversations/${conversationId}/messages`);
      const messageList = (res.data || []).map((msg) => ({
        ...msg,
        from_me: String(msg.sender_id) === String(currentUser.id),
        message_id: msg.id,
      }));
      dispatch(setMessages({ conversationId, messages: messageList }));
    };
    fetchMessages();
  }, [conversationId, selectedChat, currentUser?.id, dispatch]);

  const [typingVisible, setTypingVisible] = useState(false);
  const typingTimeout = useRef(null);
  const lastTypingAt = useRef(0);
  const TYPING_EMIT_INTERVAL = 1000;
  const lastEmitTimeRef = useRef(0);

  useEffect(() => {
    if (!socket || !currentUser?.id || !selectedChat) return;

    const handleReceiveMessage = (data) => {
      if (
        String(data.conversation_id) === String(selectedChat.conversation_id)
      ) {
        dispatch(
          addMessage({
            conversationId: String(data.conversation_id),
            message: {
              from_me: String(data.sender_id) === String(currentUser.id),
              sender_id: String(data.sender_id),
              content: data.content,
              timestamp: data.timestamp,
              message_id: data.message_id,
            },
          })
        );
      }
    };

    const handleTyping = (data) => {
      if (
        String(selectedChat.user.id) === String(data.sender_id) &&
        String(data.conversation_id) === String(selectedChat.conversation_id) &&
        String(data.sender_id) !== String(currentUser.id)
      ) {
        setTypingVisible(true);
        lastTypingAt.current = Date.now();

        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
          if (Date.now() - lastTypingAt.current >= 2000) {
            setTypingVisible(false);
          }
        }, 2000);
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("typing", handleTyping);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [socket, currentUser?.id, selectedChat, dispatch]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (socket && selectedChat) {
      const now = Date.now();
      if (now - lastEmitTimeRef.current > TYPING_EMIT_INTERVAL) {
        socket.emit("typing", {
          sender_id: String(currentUser.id),
          receiver_id: String(selectedChat.user.id),
          conversation_id: String(selectedChat.conversation_id),
        });
        lastEmitTimeRef.current = now;
      }
    }
  };

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingVisible]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setNewMessage("");
    try {
      await api.post(`/conversations/${String(conversationId)}/messages`, {
        content: newMessage.trim(),
      });
    } catch (err) {}
  };

  function handleAudioCall() {
    if (!selectedChat) return;

    const status = selectedChat.user.status;
    if (["offline", "busy", "in_call"].includes(status)) {
      toast.warn(
        t(
          "User is not available for a call right now.",
          "Kullanıcı şu anda arama için uygun değil."
        )
      );
      return;
    }

    dispatch(startCall({ type: "audio", peerUser: selectedChat.user }));
  }

  function handleVideoCall() {
    if (!selectedChat) return;

    const status = selectedChat.user.status;
    if (["offline", "busy", "in_call"].includes(status)) {
      toast.warn(
        t(
          "User is not available for a call right now.",
          "Kullanıcı şu anda arama için uygun değil."
        )
      );
      return;
    }

    dispatch(startCall({ type: "video", peerUser: selectedChat.user }));
  }
  function handleFileClick() {
    fileInputRef.current?.click();
  }
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    alert(`Dosya seçildi: ${file.name}`);
  }

  if (!selectedChat) {
    return (
      <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>
        <DotLoader /> {t("Loading chat...", "Sohbet yükleniyor...")}
      </div>
    );
  }

  let showCallStatus = false;
  if (
    inCall &&
    peerUser &&
    String(peerUser.id) === String(selectedChat.user.id)
  ) {
    showCallStatus = true;
  }

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
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* chat */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          paddingTop: inCall ? 18 : 0,
        }}
      >
        {headerVisible && (
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
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <UserAvatar user={selectedChat.user} />
              <div>
                <div style={{ fontWeight: "600", fontSize: 16 }}>
                  {selectedChat.user.first_name ||
                    selectedChat.user.name ||
                    t("User", "Kullanıcı")}
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
                      backgroundColor: getStatusColor(
                        selectedChat.user.status,
                        showCallStatus
                      ),
                      marginRight: 6,
                    }}
                  />
                  <span style={{ color: "#888" }}>
                    {getStatusText(selectedChat.user.status, showCallStatus, t)}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                style={iconBtnStyle}
                title={t("Audio Call", "Sesli Arama")}
                onClick={handleAudioCall}
              >
                <FiPhone size={22} />
              </button>
              <button
                style={iconBtnStyle}
                title={t("Video Call", "Görüntülü Arama")}
                onClick={handleVideoCall}
              >
                <FiVideo size={22} />
              </button>
            </div>
          </div>
        )}

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
          {typingVisible && (
            <div
              style={{
                color: "#8ea0c6",
                fontSize: 17,
                margin: "7px 0 0 7px",
                fontStyle: "italic",
                alignSelf: "flex-start",
                minHeight: 28,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <DotLoader />
            </div>
          )}
          <div ref={messageEndRef} />
        </div>

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
            title={t("Send File", "Dosya Gönder")}
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
            placeholder={t("Type something...", "Bir şeyler yaz...")}
            onKeyUp={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />
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
            disabled={!newMessage.trim()}
          >
            {t("Send", "Gönder")}
          </button>
        </div>
      </div>
    </div>
  );
}
