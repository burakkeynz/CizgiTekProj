import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { FiVideo, FiPhone, FiPaperclip } from "react-icons/fi";
import { useLanguage } from "./LanguageContext";
import { toast } from "react-toastify";
import api from "../api";

// Double tick (WhatsApp)
function DoubleTick({
  read_by,
  peerId,
  peerReadReceiptEnabled,
  myReadReceiptEnabled, // YENİ EKLENDİ
}) {
  const seenByPeer = read_by?.includes(peerId);

  // WhatsApp mantığı: İki tarafta da açık olacak, peer görmüş olacak
  const color =
    seenByPeer && peerReadReceiptEnabled && myReadReceiptEnabled
      ? "#41C7F3"
      : "#bbb";

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
  const { conversationId } = useParams();
  const { currentUser, socket, conversations } = useOutletContext();

  const selectedChat = conversations?.find(
    (c) => String(c.conversation_id) === String(conversationId)
  );
  const peerId = selectedChat?.user?.id;

  const isDark = document.body.getAttribute("data-theme") === "dark";
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);
  const navigate = useNavigate();

  const [peerReadReceiptEnabled, setPeerReadReceiptEnabled] = useState(
    selectedChat?.user?.read_receipt_enabled !== 1
  );
  const [myReadReceiptEnabled, setMyReadReceiptEnabled] = useState(
    currentUser?.read_receipt_enabled !== 1
  );
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingVisible, setTypingVisible] = useState(false);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef();
  useEffect(() => {
    if (!selectedChat) return;
    const fetchMessages = async () => {
      const res = await api.get(`/conversations/${conversationId}/messages`);
      const messageList = (res.data || []).map((msg) => ({
        ...msg,
        from_me: String(msg.sender_id) === String(currentUser.id),
        message_id: msg.id,
        read_by: msg.read_by || [],
      }));
      setMessages(messageList);
    };
    fetchMessages();
  }, [conversationId, selectedChat, currentUser?.id]);
  //başka sohbete geçince eski ayarı sıfırlama
  useEffect(() => {
    setPeerReadReceiptEnabled(selectedChat?.user?.read_receipt_enabled !== 1);
    setMyReadReceiptEnabled(currentUser?.read_receipt_enabled !== 1);
  }, [selectedChat, currentUser]);

  //DEBUG
  useEffect(() => {
    console.log(
      "[DEBUG][ChatDetail] peerReadReceiptEnabled:",
      peerReadReceiptEnabled,
      "myReadReceiptEnabled:",
      myReadReceiptEnabled
    );
  }, [peerReadReceiptEnabled, myReadReceiptEnabled]);

  //Debug 2
  useEffect(() => {
    console.log(
      "[ChatDetail] selectedChat.user.read_receipt_enabled",
      selectedChat?.user?.read_receipt_enabled
    );
    console.log(
      "[ChatDetail] currentUser.read_receipt_enabled",
      currentUser?.read_receipt_enabled
    );
  }, [selectedChat, currentUser]);

  // OKUNMAMIŞLARI OKUNDU YAP
  useEffect(() => {
    if (!messages.length || !currentUser?.id || !selectedChat) return;
    const unreadMsgIds = messages
      .filter(
        (msg) => !msg.from_me && !(msg.read_by || []).includes(currentUser.id)
      )
      .map((msg) => msg.message_id || msg.id);

    if (unreadMsgIds.length > 0 && selectedChat.unread_count > 0) {
      api
        .post("/conversations/mark_as_read", { message_ids: unreadMsgIds })
        .catch(() => {
          toast.error("Mesajlar okunmuş olarak işaretlenemedi.");
        });
    }
  }, [messages, currentUser?.id, selectedChat]);

  // SOCKET: MESAJ GELİNCE & OKUNDU GÜNCELLEME
  useEffect(() => {
    if (!socket || !currentUser?.id || !selectedChat) return;

    const handleReceiveMessage = (data) => {
      if (
        String(data.conversation_id) === String(selectedChat.conversation_id)
      ) {
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
    };

    const handleReadUpdate = (data) => {
      console.log("message_read_update", data); // debug!
      setMessages((msgs) =>
        msgs.map((m) => {
          if (m.message_id === data.message_id) {
            // Zaten aynı ise tekrar state set etme
            if (JSON.stringify(m.read_by) === JSON.stringify(data.read_by))
              return m;
            return { ...m, read_by: data.read_by };
          }
          return m;
        })
      );
    };

    const handleTyping = (data) => {
      if (
        String(selectedChat.user.id) === String(data.sender_id) &&
        String(data.conversation_id) === String(selectedChat.conversation_id) &&
        String(data.sender_id) !== String(currentUser.id)
      ) {
        setTypingVisible(true);
        setTimeout(() => setTypingVisible(false), 2000);
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_read_update", handleReadUpdate);
    socket.on("typing", handleTyping);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_read_update", handleReadUpdate);
      socket.off("typing", handleTyping);
    };
  }, [socket, currentUser?.id, selectedChat]);

  useEffect(() => {
    if (!socket || !selectedChat) return;
    // Sadece aktif peer ayarı gelirse güncelle
    const handlePeerSettings = (data) => {
      if (String(selectedChat.user.id) === String(data.user_id)) {
        setPeerReadReceiptEnabled(data.read_receipt_enabled !== 1);
      }
    };
    socket.on("user_settings_updated", handlePeerSettings);
    return () => socket.off("user_settings_updated", handlePeerSettings);
  }, [socket, selectedChat]);

  // Otomatik scroll
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingVisible]);

  // Input typing emit
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

  // MESAJ GÖNDER
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setNewMessage("");
    try {
      await api.post(`/conversations/${String(conversationId)}/messages`, {
        content: newMessage.trim(),
      });
    } catch (err) {}
  };

  if (!selectedChat) {
    return (
      <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>
        <DotLoader /> {t("Loading chat...", "Sohbet yükleniyor...")}
      </div>
    );
  }

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
      {/* HEADER */}
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
                    false
                  ),
                  marginRight: 6,
                }}
              />
              <span style={{ color: "#888" }}>
                {getStatusText(selectedChat.user.status, false, t)}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            style={{
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
            }}
            title={t("Audio Call", "Sesli Arama")}
            onClick={() => toast.info("Call!")}
          >
            <FiPhone size={22} />
          </button>
          <button
            style={{
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
            }}
            title={t("Video Call", "Görüntülü Arama")}
            onClick={() => toast.info("Video Call!")}
          >
            <FiVideo size={22} />
          </button>
        </div>
      </div>

      {/* MESSAGES */}
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
              {/* Önce tüm satırlar (son hariç) */}
              {allButLast && (
                <span style={{ display: "block", whiteSpace: "pre-line" }}>
                  {allButLast}
                </span>
              )}
              {/* Son satır + meta */}
              <span
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  marginTop: allButLast ? 2 : 0,
                  flexWrap: "nowrap",
                }}
              >
                {/* Son satırı taşıyan span */}
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
                  {/* <-- BURASI: DoubleTick --> */}

                  {msg.from_me ? (
                    <DoubleTick
                      read_by={msg.read_by}
                      peerId={peerId}
                      peerReadReceiptEnabled={peerReadReceiptEnabled}
                      myReadReceiptEnabled={myReadReceiptEnabled}
                    />
                  ) : null}
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

      {/* FOOTER */}
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
  );
}
