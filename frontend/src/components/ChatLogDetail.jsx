import React, { useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiFile, FiEye } from "react-icons/fi";
import FilePreviewModal from "./FilePreviewModal";

function ChatLogDetail({ logs, currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const messagesRef = useRef(null);
  const [preview, setPreview] = useState(null); // {fileType, fileUrl, fileName}

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [id]);

  const log = logs.find((log) => String(log.id) === String(id));

  const messages = React.useMemo(() => {
    if (!log) return [];
    if (Array.isArray(log.messages)) return log.messages;
    if (log.messages && typeof log.messages === "object") return [log.messages];
    if (log.messages && typeof log.messages === "string") {
      try {
        const parsed = JSON.parse(log.messages);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === "object") return [parsed];
      } catch {
        return [{ text: log.messages }];
      }
    }
    return [];
  }, [log]);

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
            border: "2px solid var(--border-card)",
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
          background: "var(--accent-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent-color)",
          fontWeight: 700,
          fontSize: 18,
          marginLeft: 10,
          boxShadow: "0 1px 5px var(--shadow-card)",
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  function getAIIcon() {
    return (
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "var(--nav-bg-active)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--nav-icon)",
          fontWeight: 800,
          fontSize: 18,
          marginRight: 10,
          boxShadow: "0 1px 5px var(--shadow-card)",
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
            background: "var(--accent-muted)",
            border: "none",
            color: "var(--accent-color)",
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
        <div style={{ marginTop: 40, color: "var(--text-muted)" }}>
          Log bulunamadı.
        </div>
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
            scrollbar-color: var(--border-card) var(--bg-main);
          }
          .chatlog-messages-scrollable::-webkit-scrollbar {
            width: 7px;
            background: var(--bg-main);
          }
          .chatlog-messages-scrollable::-webkit-scrollbar-thumb {
            background: var(--border-card);
            border-radius: 10px;
          }
          .chatlog-messages-scrollable::-webkit-scrollbar-thumb:hover {
            background: var(--accent-muted);
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
            background: "var(--accent-muted)",
            border: "none",
            color: "var(--accent-color)",
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
            transition: "background 0.15s, color 0.15s",
          }}
        >
          <FiArrowLeft size={20} />
          Tüm Loglara Dön
        </button>
        <h2
          style={{
            fontWeight: 700,
            fontSize: 26,
            color: "var(--text-main)",
            marginBottom: 16,
            alignSelf: "flex-start",
          }}
        >
          Chat Detayı
        </h2>
        <div
          style={{
            background: "var(--card-bg)",
            borderRadius: 18,
            padding: 24,
            minWidth: 330,
            maxWidth: 570,
            width: "100%",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            height: "auto",
            transition: "background 0.2s, box-shadow 0.2s",
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
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: isUser ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    marginBottom: 20,
                  }}
                >
                  {isUser ? getUserIcon() : getAIIcon()}
                  <div
                    style={{
                      background: isUser
                        ? "var(--accent-muted)"
                        : "var(--bg-muted)",
                      color: "var(--text-main)",
                      padding: "10px 16px",
                      borderRadius: 12,
                      maxWidth: "78%",
                      fontWeight: 500,
                      fontSize: 15,
                      whiteSpace: "pre-wrap",
                      marginLeft: isUser ? 0 : 6,
                      marginRight: isUser ? 6 : 0,
                      boxShadow: "0 2px 7px var(--shadow-card)",
                      transition: "box-shadow .14s, background 0.14s",
                    }}
                  >
                    {msg.text}

                    {msg.files && msg.files.length > 0 && (
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        {msg.files.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              background: "#f2f4fa",
                              borderRadius: 7,
                              padding: "4px 8px",
                              fontSize: 13,
                              border: "1px solid #e3e7ee",
                            }}
                          >
                            <FiFile style={{ marginRight: 2, fontSize: 15 }} />
                            <span
                              style={{
                                cursor: "pointer",
                                color: "#3a66e2",
                                fontWeight: 600,
                              }}
                              title="Dosyayı önizle"
                              onClick={() =>
                                setPreview({
                                  fileType: file.type,
                                  fileUrl: file.url,
                                  fileName: file.name,
                                })
                              }
                            >
                              {file.name}
                              <FiEye
                                style={{
                                  marginLeft: 5,
                                  fontSize: 15,
                                  verticalAlign: "middle",
                                }}
                              />
                            </span>
                            <a
                              href={file.url}
                              download={file.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                marginLeft: 8,
                                color: "#007bff",
                                textDecoration: "underline",
                                fontSize: 12,
                                fontWeight: 400,
                              }}
                              title="İndir"
                            >
                              İndir
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{ marginTop: 18, color: "var(--text-muted)", fontSize: 13 }}
          >
            Oluşturulma:{" "}
            {log.created_at
              ? new Date(log.created_at).toLocaleString("tr-TR")
              : "-"}
          </div>
        </div>
      </div>

      {preview && (
        <FilePreviewModal
          fileType={preview.fileType}
          fileUrl={preview.fileUrl}
          fileName={preview.fileName}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

export default ChatLogDetail;
