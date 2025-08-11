import React, { useRef, useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiFile, FiEye, FiDownload } from "react-icons/fi";
import FilePreviewModal from "./FilePreviewModal";
import { useLanguage } from "./LanguageContext";
import api from "../api";

function getS3KeyFromUrl(url) {
  if (!url) return "";
  const i = url.indexOf(".amazonaws.com/");
  if (i === -1) return url; // zaten key olabilir
  return url.substring(i + ".amazonaws.com/".length);
}

function ChatLogDetail({ logs, currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const messagesRef = useRef(null);
  const [preview, setPreview] = useState(null); // {fileType, fileKey, fileName}
  const [downloadingKey, setDownloadingKey] = useState(null);

  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [id]);

  const log = logs.find((log) => String(log.id) === String(id));

  const messages = useMemo(() => {
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

  async function handleDownload(file) {
    const key = getS3KeyFromUrl(file.url);
    try {
      setDownloadingKey(key);
      const { data } = await api.get("/files/presign", {
        params: { key, dl: true, name: file.name },
      });
      window.location.assign(data.url); // tarayıcı doğrudan indirme
    } catch (e) {
      // toast ekleyebilirim belki
    } finally {
      setDownloadingKey(null);
    }
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
          {t("Back to Logs", "Tüm Loglara Dön")}
        </button>
        <div style={{ marginTop: 40, color: "var(--text-muted)" }}>
          {t("Log not found.", "Log bulunamadı.")}
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
          {t("Back to Logs", "Tüm Loglara Dön")}
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
          {t("Chat Details", "Sohbet Detayları")}
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

                    {msg.files?.length > 0 && (
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        {msg.files.map((file, idx) => {
                          const key = getS3KeyFromUrl(file.url);
                          const isDownloading = downloadingKey === key;
                          return (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "var(--input-bg)",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 13,
                                border: "1px solid var(--input-border)",
                              }}
                            >
                              <FiFile style={{ opacity: 0.9 }} />
                              {/* Önizleme */}
                              <button
                                onClick={() =>
                                  setPreview({
                                    fileType: file.type,
                                    fileKey: key,
                                    fileName: file.name,
                                  })
                                }
                                title={t("Preview file", "Dosyayı önizle")}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#3a66e2",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {file.name}
                                <FiEye />
                              </button>

                              {/* İndir */}
                              <button
                                onClick={() => handleDownload(file)}
                                disabled={isDownloading}
                                title={t("Download", "İndir")}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#2a6df5",
                                  fontSize: 13,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  cursor: "pointer",
                                }}
                              >
                                <FiDownload />
                                {isDownloading
                                  ? t("Downloading...", "İndiriliyor...")
                                  : t("Download", "İndir")}
                              </button>
                            </div>
                          );
                        })}
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
            {t("Created At:", "Oluşturulma:")}{" "}
            {log.created_at
              ? new Date(log.created_at).toLocaleString("tr-TR")
              : "-"}
          </div>
        </div>
      </div>

      {preview && (
        <FilePreviewModal
          fileType={preview.fileType}
          fileKey={preview.fileKey} //
          fileName={preview.fileName}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

export default ChatLogDetail;
