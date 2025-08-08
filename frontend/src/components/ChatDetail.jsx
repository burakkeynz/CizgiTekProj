import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { FiVideo, FiPhone, FiPaperclip } from "react-icons/fi";
import { useSelector, useDispatch } from "react-redux";
import { startCall } from "../store/callSlice";
import { useLanguage } from "./LanguageContext";
import { toast } from "react-toastify";
import api from "../api";

// Double tick component (WhatsApp style, always inline with hour)
function DoubleTick({ read_by, peerId }) {
  const seenByPeer = read_by?.includes(peerId);
  const color = seenByPeer ? "#41C7F3" : "#bbb";
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", marginLeft: 2 }}
    >
      <svg
        width="14"
        height="14"
        style={{ position: "relative", left: 0, top: 0 }}
      >
        <polyline
          points="2,8 6,12 12,4"
          fill="none"
          stroke={color}
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        width="14"
        height="14"
        style={{ position: "relative", left: -6, top: -2 }}
      >
        <polyline
          points="2,8 6,12 12,4"
          fill="none"
          stroke={color}
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.82 }}
        />
      </svg>
    </span>
  );
}

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
  return d
    .toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", ".");
}
function DotLoader() {
  return (
    <span style={{ display: "inline-block", minWidth: 30 }}>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <style>{`
        .dot { animation: blink 1.4s infinite both; font-size: 20px; color: #bbb;}
        .dot:nth-child(2) { animation-delay: .2s; }
        .dot:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%{opacity:.1;} 20%{opacity:1;} 100%{opacity:.1;} }
      `}</style>
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

  // ---- Call state (Redux) & header visibility ----
  const callState = useSelector((state) => state.call);
  const { inCall, peerUser } = callState;
  const [headerVisible, setHeaderVisible] = useState(!inCall);

  useEffect(() => {
    if (!inCall) {
      const to = setTimeout(() => setHeaderVisible(true), 800);
      return () => clearTimeout(to);
    } else {
      setHeaderVisible(false);
    }
  }, [inCall]);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingVisible, setTypingVisible] = useState(false);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef();
  const [isSocketReady, setIsSocketReady] = useState(false);

  const selectedChat = useMemo(() => {
    return conversations?.find(
      (c) => String(c.conversation_id) === String(conversationId)
    );
  }, [conversations, conversationId]);

  const peerId = selectedChat?.user?.id;

  // Guard
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

  // socket handlers
  const handleReceiveMessage = useCallback(
    (data) => {
      if (String(data.conversation_id) === String(conversationId)) {
        setMessages((prev) => [
          ...prev,
          {
            from_me: String(data.sender_id) === String(currentUser.id),
            sender_id: String(data.sender_id),
            content: data.content,
            timestamp: data.timestamp,
            message_id: data.message_id,
            read_by: data.read_by || [],
          },
        ]);
      }
    },
    [conversationId, currentUser?.id]
  );

  const handleReadUpdate = useCallback(
    (data) => {
      if (String(data.conversation_id) !== String(conversationId)) return;
      setMessages((msgs) =>
        msgs.map((m) =>
          m.message_id === data.message_id &&
          JSON.stringify(m.read_by) !== JSON.stringify(data.read_by)
            ? { ...m, read_by: data.read_by }
            : m
        )
      );
    },
    [conversationId]
  );

  const handleTyping = useCallback(
    (data) => {
      if (
        String(selectedChat?.user?.id) === String(data.sender_id) &&
        String(data.conversation_id) === String(conversationId) &&
        String(data.sender_id) !== String(currentUser.id)
      ) {
        setTypingVisible(true);
        setTimeout(() => setTypingVisible(false), 2000);
      }
    },
    [conversationId, currentUser?.id, selectedChat]
  );

  useEffect(() => {
    if (!socket || !currentUser?.id) {
      setIsSocketReady(false);
      return;
    }
    const onConnect = () => setIsSocketReady(true);
    const onDisconnect = () => setIsSocketReady(false);

    if (socket.connected) onConnect();
    else socket.on("connect", onConnect);

    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_read_update", handleReadUpdate);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_read_update", handleReadUpdate);
      socket.off("typing", handleTyping);
    };
  }, [
    socket,
    currentUser?.id,
    handleReceiveMessage,
    handleReadUpdate,
    handleTyping,
  ]);

  useEffect(() => {
    if (!selectedChat || !isSocketReady) return;
    const fetchMessagesAndMarkRead = async () => {
      try {
        const res = await api.get(
          `/conversations/${String(conversationId)}/messages`
        );
        const list = (res.data || []).map((msg) => ({
          ...msg,
          from_me: String(msg.sender_id) === String(currentUser.id),
          message_id: msg.id,
          read_by: msg.read_by || [],
        }));
        setMessages(list);

        const unreadMsgIds = list
          .filter(
            (m) => !m.from_me && !(m.read_by || []).includes(currentUser.id)
          )
          .map((m) => m.message_id);

        if (unreadMsgIds.length > 0) {
          await api.post("/conversations/mark_as_read", {
            message_ids: unreadMsgIds,
          });
        }
      } catch (err) {
        console.log(err);
      }
    };
    fetchMessagesAndMarkRead();
  }, [conversationId, selectedChat, currentUser?.id, isSocketReady]);

  // scroll
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingVisible]);

  // typing emit
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (socket && selectedChat) {
      socket.emit("typing", {
        sender_id: String(currentUser.id),
        receiver_id: String(selectedChat.user.id),
        conversation_id: String(selectedChat.conversation_id),
      });
    }
  };

  // mesaj gönder
  const handleSendMessage = async (e) => {
    e.preventDefault?.();
    if (!newMessage.trim() || !selectedChat) return;
    const msg = newMessage.trim();
    setNewMessage("");
    try {
      await api.post(`/conversations/${String(conversationId)}/messages`, {
        content: msg,
      });
    } catch (err) {
      // eski davranış: hata tostu atıp inputu geri doldurmuyoruz
    }
  };

  // ==== ARAMA MANTIĞI (ESKİ KODLA BİREBİR) ====
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
  // ============================================

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

  const showCallStatus =
    inCall &&
    (!selectedChat?.user?.id ||
      (peerUser && String(peerUser.id) === String(selectedChat.user.id)));

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
      {/* header */}
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
        {messages.map((msg, i) => {
          const lines = (msg.content || "").split("\n");
          const lastLine = lines.pop();
          const allButLast = lines.join("\n");

          return (
            <div
              key={i}
              style={{
                maxWidth: 360,
                minWidth: 54,
                borderRadius: 17,
                fontSize: 16,
                alignSelf: msg.from_me ? "flex-end" : "flex-start",
                background: msg.from_me
                  ? "#4caf50"
                  : isDark
                  ? "#353535"
                  : "#eee",
                color: msg.from_me ? "#fff" : isDark ? "#eee" : "#23272f",
                marginLeft: msg.from_me ? 40 : 0,
                marginRight: msg.from_me ? 0 : 40,
                boxShadow: "0 1px 6px #0001",
                padding: "10px 15px 10px 15px",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
                lineHeight: 1.38,
                display: "block",
                marginBottom: 6,
                position: "relative",
              }}
            >
              {allButLast && (
                <span style={{ display: "block", whiteSpace: "pre-line" }}>
                  {allButLast}
                </span>
              )}
              <span
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  marginTop: allButLast ? 2 : 0,
                  flexWrap: "nowrap",
                }}
              >
                <span
                  style={{
                    whiteSpace: "pre-line",
                    flexGrow: 1,
                    flexShrink: 1,
                    minWidth: 0,
                    overflowWrap: "break-word",
                  }}
                >
                  {lastLine}
                </span>
                <span
                  style={{
                    marginLeft: 7,
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 13.5,
                    color: msg.from_me ? "#cfe5dc" : "#b4bcbe",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                    flexShrink: 0,
                    minWidth: 46,
                  }}
                >
                  <span>{formatDate(msg.timestamp)}</span>
                  {msg.from_me && (
                    <DoubleTick read_by={msg.read_by} peerId={peerId} />
                  )}
                </span>
              </span>
            </div>
          );
        })}

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

      {/* footer */}
      <form
        onSubmit={handleSendMessage}
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
          type="button"
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
          onClick={() => fileInputRef.current?.click()}
        >
          <FiPaperclip size={22} />
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={() => {}}
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
        />
        <button
          type="submit"
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
          disabled={!newMessage.trim()}
        >
          {t("Send", "Gönder")}
        </button>
      </form>
    </div>
  );
}
