import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";
import { useSelector } from "react-redux";
import api from "../api";

function getUserName(user, language) {
  const t = (en, tr) => (language === "tr" ? tr : en);
  if (!user) return t("Unknown user", "Bilinmeyen kullanıcı");
  if (user.name) return user.name;
  if (user.first_name && user.last_name)
    return user.first_name + " " + user.last_name;
  if (user.first_name) return user.first_name;
  if (user.username) return user.username;
  return t("Unknown user", "Bilinmeyen kullanıcı");
}
function UserAvatar({ user, language }) {
  const name = getUserName(user, language);
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "var(--nav-bg-hover)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {user?.profile_picture_url ? (
        <img
          src={user.profile_picture_url}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
          alt="Avatar"
        />
      ) : (
        <div
          style={{
            fontWeight: "bold",
            color: "var(--text-main)",
            fontSize: 18,
          }}
        >
          {name[0]?.toUpperCase() || "?"}
        </div>
      )}
    </div>
  );
}
function lastMessagePreview(content) {
  if (!content) return "";
  if (typeof content === "string") return content.slice(0, 40);
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0];
    if (typeof first === "object" && first !== null)
      return (
        first.text?.slice(0, 40) ||
        first.message?.slice(0, 40) ||
        JSON.stringify(first).slice(0, 40)
      );
    return String(first).slice(0, 40);
  }
  if (typeof content === "object" && content !== null)
    return (
      content.text?.slice(0, 40) ||
      content.message?.slice(0, 40) ||
      JSON.stringify(content).slice(0, 40)
    );
  return String(content).slice(0, 40);
}

export default function Chat({
  currentUser,
  socket,
  conversations,
  setConversations,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const call = useSelector((state) => state.call);

  const [availableUsers, setAvailableUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      const availRes = await api.get("/users/available");
      setAvailableUsers(availRes.data);
    };
    fetchUsers();
  }, []);

  const handleUserSelect = async (user) => {
    setShowDropdown(false);
    const existing = conversations.find(
      (c) => String(c.user?.id) === String(user.id)
    );
    if (existing) {
      navigate(`/chat/${existing.conversation_id}`);
      return;
    }
    const res = await api.post("/conversations/start_conversation", {
      receiver_id: user.id,
    });
    setConversations((prev) => [
      ...prev,
      { user, conversation_id: res.data.conversation_id, last_message: null },
    ]);
    navigate(`/chat/${res.data.conversation_id}`);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        background: "var(--bg-main)",
      }}
    >
      {/* Sol panel */}
      <div
        style={{
          width: 320,
          borderRight: "1.5px solid var(--border-card)",
          background: "var(--nav-bg)",
          color: "var(--text-main)",
          padding: 0,
          overflowY: "auto",
          position: "relative",
          boxShadow: "2px 0 10px #0002",
          transition: "background .2s, color .2s",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px 12px 22px",
            fontWeight: 700,
            fontSize: 22,
            borderBottom: "1px solid var(--border-card)",
            background: "var(--nav-bg)",
            transition: "background .2s, color .2s",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 21,
              color: "var(--text-label)",
            }}
          >
            {t("Chats", "Sohbetler")}
          </span>
          <button
            style={{
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
              background: "var(--accent-color)",
              color: "#fff",
              boxShadow: "0 2px 12px var(--accent-muted), 0 1px 4px #0001",
              transition: "background .17s, box-shadow .17s",
            }}
            onClick={() => setShowDropdown((v) => !v)}
            title={t("Create New Chat", "Yeni Sohbet Oluştur")}
          >
            +
          </button>
        </div>
        {conversations.length === 0 && (
          <div
            style={{
              margin: "auto",
              fontSize: 19,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            {t("No chat yet", "Henüz sohbet yok")}
          </div>
        )}
        {conversations.map((c) => (
          <div
            key={c.user?.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "13px 16px",
              cursor: "pointer",
              borderBottom: "1px solid var(--border-card)",
              fontSize: 16,
              borderRadius: 10,
              transition: "background .17s",
              background:
                String(conversationId) === String(c.conversation_id)
                  ? "var(--nav-bg-active)"
                  : "transparent",
              marginBottom: 2,
            }}
            onClick={() => handleUserSelect(c.user)}
          >
            <UserAvatar user={c.user} />
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 16,
                  color: "var(--text-label)",
                }}
              >
                {getUserName(c.user)}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  maxWidth: 175,
                }}
              >
                {c.last_message
                  ? `${
                      c.last_message.from_me ? t("You: ", "Sen: ") : ""
                    }${lastMessagePreview(c.last_message.content)}`
                  : t("No message yet", "Henüz mesaj yok")}
              </div>
            </div>
          </div>
        ))}
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: 60,
              left: 0,
              right: 0,
              zIndex: 999,
              borderRadius: 14,
              boxShadow: isDark ? "0 6px 24px #0004" : "0 6px 24px #b1bfd622",
              padding: "16px 10px 10px 10px",
              minHeight: 85,
              minWidth: 240,
              background: "var(--card-bg)",
              color: "var(--text-main)",
              animation: "dropdownAnim 0.13s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
                padding: "0 8px",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {t("Select Person", "Kişi Seç")}
              </span>
              <span
                onClick={() => setShowDropdown(false)}
                style={{ cursor: "pointer", fontSize: 18, padding: 3 }}
              >
                ✕
              </span>
            </div>
            {availableUsers.length === 0 && (
              <div
                style={{
                  padding: 24,
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                {t("No user", "Kullanıcı yok")}
              </div>
            )}
            {availableUsers.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "13px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border-card)",
                  fontSize: 16,
                  borderRadius: 10,
                  background: "transparent",
                  marginBottom: 2,
                }}
                onClick={() => handleUserSelect(u)}
              >
                <UserAvatar user={u} />
                <div>{getUserName(u)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Orta panel */}
      <div
        id="main-chat-panel"
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
          background: "var(--bg-main)",
          transition: "background .2s, color .2s",
        }}
      >
        {conversationId ? (
          <Outlet
            context={{ currentUser, socket, conversations, setConversations }}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 24,
              letterSpacing: 0.3,
              fontWeight: 500,
            }}
          >
            {t(
              "Select a chat or create new one.",
              "Bir sohbet seç ya da oluştur."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
