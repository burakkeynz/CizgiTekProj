import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiUpload, FiX, FiFile, FiEye } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import api from "../api";
import { useTheme } from "./ThemeContext";
import FilePreviewModal from "./FilePreviewModal";

const SESSION_KEY = "ai_assistang_logs:";
const INITIAL_MSG = [{ role: "model", text: "Hi! How can I help you?" }];

function DotLoader() {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: 28,
      }}
    >
      <span className="dot">.</span>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <style>
        {`
          .dot { animation: blink 1.4s infinite both; font-size: 22px; color: var(--accent-color);}
          .dot:nth-child(2) { animation-delay: .2s; }
          .dot:nth-child(3) { animation-delay: .4s; }
          @keyframes blink { 0%{opacity:.1;} 20%{opacity:1;} 100%{opacity:.1;} }
        `}
      </style>
    </span>
  );
}

function getS3KeyFromUrl(url) {
  const idx = url.indexOf(".amazonaws.com/");
  if (idx === -1) return url; // zaten key
  return url.substring(idx + ".amazonaws.com/".length);
}

function Assistant({ onNewLog }) {
  const location = useLocation();
  const { theme } = useTheme();

  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ai_assistant_open");
      return saved === null ? true : JSON.parse(saved);
    } catch {
      return true;
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : INITIAL_MSG;
    } catch {
      return INITIAL_MSG;
    }
  });

  // Dosya önizleme modalı ve loading state
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setIsOpen(false);
    sessionStorage.setItem("ai_assistant_open", JSON.stringify(false));
  }, [location]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedFileUrl, setSelectedFileUrl] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem("ai_assistant_open", JSON.stringify(isOpen));
  }, [isOpen]);
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);
  useEffect(() => {
    if (selectedFile) {
      setSelectedFileUrl(URL.createObjectURL(selectedFile));
    } else {
      setSelectedFileUrl(null);
    }
    return () => {
      if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    };
  }, [selectedFile]);

  const handleClose = () => setIsOpen(false);

  const handleEndDiscussion = async () => {
    try {
      const logs = sessionStorage.getItem(SESSION_KEY);
      if (logs && JSON.parse(logs).length > 1) {
        const newLog = {
          id: "temp-" + Date.now(),
          messages: JSON.parse(logs),
          created_at: new Date().toISOString(),
          optimistic: true,
        };
        if (onNewLog) onNewLog(newLog);
        api.post("/chatlogs/", {
          messages: newLog.messages,
          ended_at: newLog.created_at,
        });
      }
    } catch (e) {
      console.error("Chat log veritabana kaydedilemedi:", e);
    }
    setMessages(INITIAL_MSG);
    sessionStorage.removeItem(SESSION_KEY);
    setIsOpen(false);
  };

  const sendMessage = async () => {
    if (loading || (!input.trim() && selectedFiles.length === 0)) return;
    setLoading(true);

    // Önce dosyaları S3'e yükle
    let uploadedFiles = [];
    if (selectedFiles.length > 0) {
      try {
        const fileUploadPromises = selectedFiles.map(async (file) => {
          const data = new FormData();
          data.append("file", file);
          const res = await api.post("/upload/file", data, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return {
            url: res.data.url, // S3 url
            name: file.name,
            type: file.type,
          };
        });
        uploadedFiles = await Promise.all(fileUploadPromises);
      } catch (err) {
        setLoading(false);
        alert("Dosya yüklenirken hata oluştu!");
        return;
      }
    }

    const userMsg = {
      role: "user",
      text: input,
      files: uploadedFiles,
    };

    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "model", text: "...", isLoader: true },
    ]);

    setInput("");
    setSelectedFiles([]);

    try {
      const formData = new FormData();
      formData.append("message", input || "");
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((file) => {
          formData.append("files", file.url);
        });
      }
      formData.append("web_search", activeTool === "search" ? "true" : "false");
      formData.append("contents", JSON.stringify(messages));

      const res = await api.post("/gemini/chat", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const responseText =
        res.data?.response || res.data?.raw_response || "Yanıt yok";
      setMessages((msgs) => {
        const msgsWithoutLoader = msgs.filter((msg) => !msg.isLoader);
        return [...msgsWithoutLoader, { role: "model", text: responseText }];
      });
    } catch (err) {
      setMessages((msgs) => {
        const msgsWithoutLoader = msgs.filter((msg) => !msg.isLoader);
        return [
          ...msgsWithoutLoader,
          {
            role: "model",
            text: "Bir hata oluştu, lütfen tekrar deneyin.",
          },
        ];
      });
    } finally {
      setLoading(false);
      setActiveTool(null);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFilePreview = async (file) => {
    setPreviewLoading(true);
    let fileUrl = file.url;
    try {
      let key = file.url;
      if (file.url.includes("amazonaws.com")) key = getS3KeyFromUrl(file.url);
      const res = await api.get(`/files/presign`, { params: { key } });
      fileUrl = res.data.url;
    } catch (err) {
      alert("Dosya önizleme linki alınamadı.");
      setPreviewLoading(false);
      return;
    }
    setPreview({
      fileType: file.type,
      fileUrl,
      fileName: file.name,
    });
    setPreviewLoading(false);
  };

  if (!isOpen) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 32,
          zIndex: 50,
          cursor: "pointer",
          background: "var(--accent-color)",
          color: "#fff",
          borderRadius: "50%",
          width: 54,
          height: 54,
          boxShadow: "0 3px 18px var(--shadow-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          fontWeight: "bold",
          transition: "background 0.13s",
        }}
        onClick={() => setIsOpen(true)}
        title="AI Asistan'ı aç"
      >
        💬
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: 475,
        maxHeight: 480,
        background: "var(--card-bg)",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        border: "1px solid var(--input-border)",
        boxShadow: "0 -2px 10px #00000008",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        transition: "background 0.13s, border 0.13s",
      }}
    >
      <div
        style={{
          background: "var(--accent-color)",
          color: "#fff",
          padding: "12px 0",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          textAlign: "center",
          fontWeight: "bold",
          fontSize: 18,
          transition: "background 0.2s",
        }}
      >
        AI-Assistant
        <span
          style={{
            position: "absolute",
            right: 18,
            top: 14,
            cursor: "pointer",
            opacity: 0.85,
          }}
          onClick={handleClose}
        >
          <FiX size={22} />
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "var(--card-bg)",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background:
                msg.role === "user" ? "var(--accent-color)" : "var(--input-bg)",
              color: msg.role === "user" ? "#fff" : "var(--text-main)",
              padding: "8px 14px",
              borderRadius: 12,
              maxWidth: "78%",
              whiteSpace: "pre-wrap",
              fontSize: 15,
              minHeight: msg.isLoader ? 28 : undefined,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              boxShadow:
                msg.role === "user" ? "0 1px 4px var(--shadow-card)" : "none",
              border:
                msg.role === "user"
                  ? "1px solid var(--accent-color)"
                  : "1px solid var(--input-border)",
              transition: "background 0.2s, color 0.2s",
              position: "relative",
            }}
          >
            {msg.files && msg.files.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                {msg.files.map((file, i) => (
                  <div
                    key={i}
                    className="file-badge"
                    onClick={() => handleFilePreview(file)}
                    style={{
                      background: "rgba(255,255,255,0.11)",
                      color: "#fff",
                      borderRadius: 7,
                      padding: "5px 10px",
                      fontSize: 13,
                      marginBottom: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      border: "1.2px solid #fff2",
                      minWidth: 130,
                    }}
                    title="Dosyayı önizle"
                  >
                    <FiFile style={{ marginRight: 3, opacity: 0.95 }} />
                    <span
                      style={{
                        maxWidth: 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </span>
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 12,
                        opacity: 0.85,
                        display: "flex",
                        alignItems: "center",
                      }}
                      className="preview-hover-label"
                    >
                      <FiEye size={13} style={{ marginRight: 2 }} /> Aç
                    </span>
                  </div>
                ))}
              </div>
            )}

            {msg.fileName && (
              <div
                className="file-badge"
                onClick={() =>
                  handleFilePreview({
                    type: msg.fileType,
                    url: msg.fileUrl,
                    name: msg.fileName,
                  })
                }
                style={{
                  background: "rgba(255,255,255,0.11)",
                  color: "#fff",
                  borderRadius: 7,
                  padding: "5px 10px",
                  fontSize: 13,
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  border: "1.2px solid #fff2",
                  minWidth: 130,
                }}
                title="Dosyayı önizle"
              >
                <FiFile style={{ marginRight: 3, opacity: 0.95 }} />
                <span
                  style={{
                    maxWidth: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {msg.fileName}
                </span>
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 12,
                    opacity: 0.85,
                    display: "flex",
                    alignItems: "center",
                  }}
                  className="preview-hover-label"
                >
                  <FiEye size={13} style={{ marginRight: 2 }} /> Aç
                </span>
              </div>
            )}

            {msg.isLoader ? (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 28,
                  padding: 0,
                  margin: 0,
                }}
              >
                <DotLoader />
              </div>
            ) : (
              msg.text
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {preview && (
        <FilePreviewModal
          fileType={preview.fileType}
          fileUrl={preview.fileUrl}
          fileName={preview.fileName}
          onClose={() => setPreview(null)}
        />
      )}

      <div
        style={{
          padding: 10,
          borderTop: "1px solid var(--input-border)",
          background: "var(--card-bg)",
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button
            onClick={() =>
              setActiveTool((prev) => (prev === "search" ? null : "search"))
            }
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              fontSize: 13,
              borderRadius: 6,
              background:
                activeTool === "search"
                  ? "var(--accent-color)"
                  : "var(--input-bg)",
              color: activeTool === "search" ? "#fff" : "var(--text-main)",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              transition: "background 0.18s, color 0.18s",
            }}
          >
            <FiSearch />
            Web Search
          </button>

          <label
            htmlFor="file-upload"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              fontSize: 13,
              borderRadius: 6,
              background:
                activeTool === "upload"
                  ? "var(--accent-color)"
                  : "var(--input-bg)",
              color: activeTool === "upload" ? "#fff" : "var(--text-main)",
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              transition: "background 0.18s, color 0.18s",
              position: "relative",
            }}
          >
            <FiUpload />
            Add photos & files
            <input
              id="file-upload"
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const files = Array.from(e.target.files);
                setSelectedFiles((prev) => {
                  const all = [...prev, ...files];
                  const unique = all.filter(
                    (file, idx, self) =>
                      idx ===
                      self.findIndex(
                        (f) => f.name === file.name && f.size === file.size
                      )
                  );
                  // En fazla 5 tane dosya
                  if (unique.length > 5) {
                    alert("En fazla 5 dosya seçebilirsiniz!");
                  }
                  return unique.slice(0, 5);
                });
                setActiveTool("upload");
              }}
            />
          </label>
        </div>

        {selectedFiles.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              margin: "8px 0",
            }}
          >
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--input-border)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 13,
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    maxWidth: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.name}
                </span>
                <span
                  style={{
                    marginLeft: 6,
                    cursor: "pointer",
                    opacity: 0.7,
                    fontSize: 16,
                  }}
                  onClick={() =>
                    setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))
                  }
                  title="Dosyayı kaldır"
                >
                  <FiX />
                </span>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          disabled={loading}
          placeholder="Ask Assistant..."
          rows={2}
          style={{
            width: "100%",
            resize: "none",
            borderRadius: 8,
            padding: "10px 12px",
            border: "1.5px solid var(--input-border)",
            fontSize: 14,
            marginBottom: 8,
            background: "var(--input-bg)",
            color: "var(--text-main)",
            fontFamily: "inherit",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.18s",
          }}
        />
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              flex: 1,
              background: "var(--accent-color)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 0",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
              transition: "background 0.18s",
            }}
          >
            Send
          </button>
          <button
            onClick={handleEndDiscussion}
            style={{
              flex: 1,
              border: "1px solid var(--input-border)",
              borderRadius: 6,
              padding: "8px 0",
              fontSize: 14,
              background: "var(--input-bg)",
              color: "var(--text-main)",
              cursor: "pointer",
              fontWeight: 500,
              transition: "background 0.18s, color 0.18s",
            }}
          >
            End Discussion
          </button>
        </div>
      </div>
    </div>
  );
}

export default Assistant;
