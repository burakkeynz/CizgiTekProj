import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiUpload, FiX, FiFile, FiEye } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import api from "../api";
import { useTheme } from "./ThemeContext";
import FilePreviewModal from "./FilePreviewModal";
import { MessageList } from "@chatscope/chat-ui-kit-react";

const SESSION_KEY = "ai_assistang_logs:";
const INITIAL_MSG = [{ role: "model", text: "Hi! How can I help you?" }];

function DotLoader() {
  return (
    <>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 28,
          width: "100%",
        }}
      >
        <span className="dot">.</span>
        <span className="dot">.</span>
        <span className="dot">.</span>
      </span>
      <style>
        {`
          .dot {
            animation: blink 1.4s infinite both;
            font-size: 22px;
            color: var(--accent-color);
            margin: 0 2px;
            letter-spacing: 2px;
          }
          .dot:nth-child(2) { animation-delay: .18s; }
          .dot:nth-child(3) { animation-delay: .36s; }
          @keyframes blink {
            0%{opacity:.25;}
            20%{opacity:1;}
            100%{opacity:.25;}
          }
        `}
      </style>
    </>
  );
}

function getS3KeyFromUrl(url) {
  const idx = url.indexOf(".amazonaws.com/");
  if (idx === -1) return url;
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
  const [streamText, setStreamText] = useState("");
  const chatWrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !chatWrapperRef.current) return;
    chatWrapperRef.current.scrollTo({
      top: chatWrapperRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isOpen, streamText]);

  useEffect(() => {
    sessionStorage.setItem("ai_assistant_open", JSON.stringify(isOpen));
  }, [isOpen]);
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (selectedFile) setSelectedFileUrl(URL.createObjectURL(selectedFile));
    else setSelectedFileUrl(null);
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

    let uploadedFiles = [];
    if (selectedFiles.length > 0) {
      try {
        const fileUploadPromises = selectedFiles.map(async (file) => {
          const data = new FormData();
          data.append("file", file);
          const res = await api.post("/upload/file", data, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return { url: res.data.url, name: file.name, type: file.type };
        });
        uploadedFiles = await Promise.all(fileUploadPromises);
      } catch (err) {
        setLoading(false);
        alert("Dosya yüklenirken hata oluştu!");
        return;
      }
    }

    const userMsg = { role: "user", text: input, files: uploadedFiles };
    const allMsgs = [...messages, userMsg];
    setMessages([
      ...allMsgs,
      { role: "model", text: "", isLoader: true, files: uploadedFiles },
    ]);
    setInput("");
    setSelectedFiles([]);
    setStreamText("");

    try {
      const formData = new FormData();
      formData.append("message", input || "");
      if (uploadedFiles.length > 0)
        uploadedFiles.forEach((file) => formData.append("files", file.url));
      formData.append("web_search", activeTool === "search" ? "true" : "false");
      formData.append("contents", JSON.stringify(allMsgs));

      const BASE_URL = process.env.REACT_APP_API_URL;
      const response = await fetch(`${BASE_URL}/gemini/chat/stream`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.body) throw new Error("Sunucudan yanıt alınamadı.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let runningText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        runningText += chunk;
        setStreamText(runningText);
        setMessages((msgs) => {
          const msgsWithoutLoader = msgs.filter((msg) => !msg.isLoader);
          return [
            ...msgsWithoutLoader,
            { role: "model", text: runningText, isLoader: true },
          ];
        });
        await new Promise((r) => setTimeout(r, 10));
      }

      setStreamText("");
      setMessages((msgs) => {
        const msgsWithoutLoader = msgs.filter((msg) => !msg.isLoader);
        return [...msgsWithoutLoader, { role: "model", text: runningText }];
      });
    } catch (err) {
      setStreamText("");
      setMessages((msgs) => {
        const msgsWithoutLoader = msgs.filter((msg) => !msg.isLoader);
        return [
          ...msgsWithoutLoader,
          { role: "model", text: "Bir hata oluştu, lütfen tekrar deneyin." },
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
    setPreview({ fileType: file.type, fileUrl, fileName: file.name });
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

  function renderLoader(msg) {
    if (msg.isLoader && (!msg.text || msg.text.trim() === "")) {
      if (msg.files && msg.files.length > 0) {
        const label =
          msg.files.length > 1
            ? "Examining the files..."
            : "Examining the file...";
        return (
          <span
            style={{
              fontSize: 16,
              color: "var(--ai-assistant-loader)",
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        );
      }
      // Web search için
      if (activeTool === "search")
        return (
          <span
            style={{
              fontSize: 16,
              color: "var(--ai-assistant-loader)",
              fontWeight: 500,
            }}
          >
            Searching Web...
          </span>
        );
      return <DotLoader />;
    }
    return msg.text;
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
        ref={chatWrapperRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 14,
          background: "var(--card-bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MessageList>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10,
                width: "100%",
              }}
            >
              <div
                style={{
                  // Sadece kendi mesajların sağa koyma
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  display: "flex",
                  flexDirection: "column",
                  width: "fit-content",
                  maxWidth: "68%",
                }}
              >
                {msg.files &&
                  msg.files.length > 0 &&
                  msg.role === "user" &&
                  !msg.isLoader && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      {msg.files.map((file, i) => (
                        <div
                          key={i}
                          onClick={() => handleFilePreview(file)}
                          style={{
                            background: "rgba(255,255,255,0.13)",
                            color: "#fff",
                            borderRadius: 7,
                            padding: "5px 10px",
                            fontSize: 13,
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
                          >
                            <FiEye size={13} style={{ marginRight: 2 }} /> Aç
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                <div
                  style={{
                    background:
                      msg.role === "user"
                        ? "var(--accent-color)"
                        : "var(--input-bg)",
                    color: msg.role === "user" ? "#fff" : "var(--text-main)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    minHeight: 28,
                    padding: "10px 16px",
                    borderRadius: 16,
                    border:
                      msg.role === "user"
                        ? "1px solid var(--accent-color)"
                        : "1px solid var(--input-border)",
                    boxShadow:
                      msg.role === "user"
                        ? "0 1px 4px var(--shadow-card)"
                        : "none",
                    fontSize: 15,
                    marginLeft: msg.role === "user" ? 30 : 0,
                    marginRight: msg.role === "model" ? 30 : 0,
                    marginBottom: 2,
                    borderTopRightRadius: msg.role === "user" ? 4 : 16,
                    borderTopLeftRadius: msg.role === "model" ? 4 : 16,
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    transition: "background 0.2s, color 0.2s",
                    width: "fit-content",
                    maxWidth: "100%",
                  }}
                >
                  {msg.isLoader ? renderLoader(msg) : msg.text}
                </div>
              </div>
            </div>
          ))}
        </MessageList>
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
            <FiSearch /> Web Search
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
            <FiUpload /> Add photos & files
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
                  if (unique.length > 5)
                    alert("En fazla 5 dosya seçebilirsiniz!");
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
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
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
