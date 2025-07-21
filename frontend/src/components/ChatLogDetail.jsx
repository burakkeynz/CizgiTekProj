import React, { useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

function ChatLogDetail({ logs, currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const messagesRef = useRef(null);

  // Scroll otomatiği (chat uzun ise aşağıya kay)
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [id]);

  const log = logs.find((log) => String(log.id) === String(id));

  // Kullanıcının baş harfi ya da fotoğrafı
  function getUserIcon() {
    if (currentUser?.photo_url) {
      return (
        <img
          src={currentUser.photo_url}
          alt="Kullanıcı"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            objectFit: "cover",
            marginLeft: 10,
            border: "2px solid #e4e4e4",
          }}
        />
      );
    }
    const name = currentUser?.full_name || currentUser?.username || "?";
    return (
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "#eef6fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#007cff",
          fontWeight: 700,
          fontSize: 18,
          marginLeft: 10,
          boxShadow: "0 1px 5px #e0e7ef55",
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  // AI (Gemini) ikonu
  function getAIIcon() {
    return (
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "#e0e7ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#4b5ec9",
          fontWeight: 800,
          fontSize: 18,
          marginRight: 10,
          boxShadow: "0 1px 5px #e0e7ef44",
        }}
      >
        G
      </div>
    );
  }

  if (!log) {
    return (
      <div style={{ padding: 32 }}>
        <button
          onClick={() => navigate("/logs")}
          style={{
            background: "#eef3fb",
            border: "none",
            color: "#2273c5",
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            marginBottom: 18,
            alignSelf: "flex-start",
            padding: "8px 18px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <FiArrowLeft size={20} />
          Tüm Loglara Dön
        </button>
        <div style={{ marginTop: 40, color: "#7a879a" }}>Log bulunamadı.</div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          .chatlog-messages-scrollable {
            max-height: 72vh;
            overflow-y: auto;
            padding-right: 4px;
            scrollbar-width: thin;
            scrollbar-color: #b8c3d7 #f8fafc;
          }
          .chatlog-messages-scrollable::-webkit-scrollbar {
            width: 7px;
            background: #f8fafc;
          }
          .chatlog-messages-scrollable::-webkit-scrollbar-thumb {
            background: #c7d1e6;
            border-radius: 10px;
          }
          .chatlog-messages-scrollable::-webkit-scrollbar-thumb:hover {
            background: #a6b3c6;
          }
        `}
      </style>
      <div
        style={{
          padding: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <button
          onClick={() => navigate("/logs")}
          style={{
            background: "#eef3fb",
            border: "none",
            color: "#2273c5",
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            marginBottom: 18,
            alignSelf: "flex-start",
            padding: "8px 18px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <FiArrowLeft size={20} />
          Tüm Loglara Dön
        </button>
        <h2
          style={{
            fontWeight: 700,
            fontSize: 26,
            color: "#253046",
            marginBottom: 16,
            alignSelf: "flex-start",
          }}
        >
          Chat Detayı
        </h2>
        <div
          style={{
            background: "#fafdff",
            borderRadius: 18,
            padding: 24,
            minWidth: 330,
            maxWidth: 570,
            width: "100%",
            boxShadow: "0 1px 8px #dde5fa1b",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            height: "auto",
          }}
        >
          <div
            className="chatlog-messages-scrollable"
            ref={messagesRef}
            style={{
              minHeight: 180,
              maxHeight: "65vh",
              overflowY: "auto",
              marginBottom: 10,
            }}
          >
            {log.messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: isUser ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    marginBottom: 20, // 14 -> 20 px spacing
                  }}
                >
                  {isUser ? getUserIcon() : getAIIcon()}
                  <div
                    style={{
                      background: isUser ? "#e0f7fa" : "#e3e8f5",
                      color: "#24446b",
                      padding: "10px 16px",
                      borderRadius: 12,
                      maxWidth: "78%",
                      fontWeight: 500,
                      fontSize: 15,
                      whiteSpace: "pre-wrap",
                      marginLeft: isUser ? 0 : 6,
                      marginRight: isUser ? 6 : 0,
                      boxShadow: "0 2px 7px #c6d4e40c",
                      transition: "box-shadow .14s",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 18, color: "#7a879a", fontSize: 13 }}>
            Oluşturulma:{" "}
            {log.created_at
              ? new Date(log.created_at).toLocaleString("tr-TR")
              : "-"}
          </div>
        </div>
      </div>
    </>
  );
}

export default ChatLogDetail;
