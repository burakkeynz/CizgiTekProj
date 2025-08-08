import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiUpload, FiX, FiFile, FiEye } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import { useLanguage } from "./LanguageContext";
import api from "../api";
import { useTheme } from "./ThemeContext";
import FilePreviewModal from "./FilePreviewModal";
import { MessageList } from "@chatscope/chat-ui-kit-react";

//yeni importlarım, mic ile kaydetme için
import { FiMic, FiStopCircle } from "react-icons/fi";
import { startStreamRecording } from "../utils/webrtc";

const SESSION_KEY = "ai_assistang_logs:";
const AUDIO_EXTS = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".webm"];
const isAudioLike = (f) =>
  (f?.type || "").startsWith("audio/") ||
  AUDIO_EXTS.some((ext) => f?.name?.toLowerCase()?.endsWith(ext));

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
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);
  const initialMessage = {
    role: "model",
    text: t(
      "Hi! How can I help you?",
      "Merhaba! Size nasıl yardımcı olabilirim?"
    ),
  };
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
      return saved ? JSON.parse(saved) : [initialMessage];
    } catch {
      return [initialMessage];
    }
  });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  //yeni statelerim kaydetme için
  const [isRecording, setIsRecording] = useState(false);
  const recRef = useRef(null);
  const gumStreamRef = useRef(null);

  useEffect(() => {
    setIsOpen(false);
    sessionStorage.setItem("ai_assistant_open", JSON.stringify(false));
  }, [location]);
  useEffect(() => {
    const en = "Hi! How can I help you?";
    const tr = "Merhaba! Size nasıl yardımcı olabilirim?";
    const translated = language === "tr" ? tr : en;

    setMessages((prevMessages) => {
      if (prevMessages.length === 0) return prevMessages;

      const firstMsg = prevMessages[0];
      if (firstMsg.role !== "model") return prevMessages;

      if (firstMsg.text === translated) return prevMessages;

      const updatedMessages = [
        { ...firstMsg, text: translated },
        ...prevMessages.slice(1),
      ];

      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedMessages));
      } catch {}

      return updatedMessages;
    });
  }, [language]);

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
      console.error(
        t(
          "Chat log could not be saved to the database.",
          "Sohbet geçmişi veritabana kaydedilemedi:"
        ),
        e
      );
    }
    setMessages([initialMessage]);
    sessionStorage.removeItem(SESSION_KEY);
    setIsOpen(false);
  };

  async function micStart() {
    try {
      const gum = await navigator.mediaDevices.getUserMedia({ audio: true });
      gumStreamRef.current = gum;
      const { stop, filePromise } = startStreamRecording(gum);
      recRef.current = { stop, filePromise };
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      alert(
        t(
          "Microphone permission denied or unsupported.",
          "Mikrofon izni reddedildi veya desteklenmiyor."
        )
      );
    }
  }

  async function micStop() {
    try {
      recRef.current?.stop?.();
      const file = await recRef.current?.filePromise;
      if (file) {
        setSelectedFiles((prev) => [...prev, file]);
      }
    } catch (e) {
      console.error("micStop error:", e);
    } finally {
      gumStreamRef.current?.getTracks?.().forEach((tr) => tr.stop());
      gumStreamRef.current = null;
      recRef.current = null;
      setIsRecording(false);
    }
  }

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
        alert(
          t(
            "An error occurred while uploading the file!",
            "Dosya yüklenirken hata oluştu!"
          )
        );
        return;
      }
    }

    const audioFiles = uploadedFiles.filter(isAudioLike);
    const otherFiles = uploadedFiles.filter((f) => !isAudioLike(f));
    const hasAudio = audioFiles.length > 0;

    const userMsg = { role: "user", text: input, files: uploadedFiles };
    const allMsgs = [...messages, userMsg];
    setMessages([
      ...allMsgs,
      {
        role: "model",
        text: "",
        isLoader: true,
        files: uploadedFiles,
        isAudio: hasAudio,
      },
    ]);
    setInput("");
    setSelectedFiles([]);
    setStreamText("");

    try {
      const formData = new FormData();
      const BASE_URL = process.env.REACT_APP_API_URL;

      if (hasAudio && otherFiles.length === 0) {
        formData.append(
          "prompt",
          input?.trim() ? input : "Generate a transcript of the speech."
        );
        audioFiles.forEach((file) => formData.append("files", file.url));
        var endpoint = "/gemini/audio/transcribe";
      } else {
        formData.append("message", input || "");
        uploadedFiles.forEach((file) => formData.append("files", file.url));
        formData.append(
          "web_search",
          activeTool === "search" ? "true" : "false"
        );
        formData.append("contents", JSON.stringify(allMsgs));
        var endpoint = "/gemini/chat/stream";
      }

      const response = await fetch(`${BASE_URL}${endpoint}`, {
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
          {
            role: "model",
            text: t(
              "Something went wrong. Please try again.",
              "Bir hata oluştu, lütfen tekrar deneyin."
            ),
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
      alert(
        t(
          "Failed to generate file preview link.",
          "Dosya önizleme linki alınamadı."
        )
      );
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
        title={t("Open AI Assistant", "AI Asistan'ı aç")}
      >
        💬
      </div>
    );
  }

  function renderLoader(msg) {
    if (msg.isAudio) {
      return (
        <span
          style={{
            fontSize: 16,
            color: "var(--ai-assistant-loader)",
            fontWeight: 500,
          }}
        >
          {t("Transcribing audio...", "Ses çözümleniyor...")}
        </span>
      );
    }
    if (msg.isLoader && (!msg.text || msg.text.trim() === "")) {
      if (msg.files && msg.files.length > 0) {
        const label =
          msg.files.length > 1
            ? t("Examining the files...", "Dosyalar inceleniyor...")
            : t("Examining the file...", "Dosya inceleniyor...");
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
            {t("Searching web...", "Web'de araştırılıyor...")}
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
        {t("AI-Assistant", "AI-Asistan")}
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
                          title={t("Preview file", "Dosyayı önizle")}
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
                            <FiEye size={13} style={{ marginRight: 2 }} />{" "}
                            {t("Open", "Aç")}
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
            <FiSearch /> {t("Web Search", "Web'de Ara")}
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
            <FiUpload /> {t("Add photos & files", "Fotoğraf & dosya ekle")}
            <input
              id="file-upload"
              type="file"
              multiple
              style={{ display: "none" }}
              accept="audio/*,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
                    alert(
                      t(
                        "You can select up to 5 files only!",
                        "En fazla 5 dosya seçebilirsiniz!"
                      )
                    );
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
                  title={t("Remove file", "Dosyayı kaldır")}
                >
                  <FiX />
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ position: "relative", marginBottom: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={loading && !isRecording} // kayıt sürerken mici durdurabilelim
            placeholder={t("Ask Assistant...", "Asistana sor...")}
            rows={2}
            style={{
              width: "100%",
              resize: "none",
              borderRadius: 8,
              padding: "10px 12px",
              paddingRight: 48,
              border: "1.5px solid var(--input-border)",
              fontSize: 14,
              background: "var(--input-bg)",
              color: "var(--text-main)",
              fontFamily: "inherit",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
              transition: "all 0.18s",
            }}
          />
          <button
            type="button"
            onClick={() => (isRecording ? micStop() : micStart())}
            aria-label={
              isRecording
                ? t("Stop recording", "Kaydı durdur")
                : t("Start recording", "Kaydı başlat")
            }
            title={
              isRecording
                ? t("Stop recording", "Kaydı durdur")
                : t("Start recording", "Kaydı başlat")
            }
            disabled={loading && !isRecording}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid var(--input-border)",
              background: isRecording ? "#ffefef" : "var(--card-bg)",
              color: isRecording ? "#d00" : "var(--text-main)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,.05)",
              zIndex: 2,
              transition: "all .15s",
            }}
          >
            {isRecording ? <FiStopCircle size={16} /> : <FiMic size={16} />}
          </button>
        </div>

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
            {t("Send", "Gönder")}
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
            {t("End Discussion", "Sohbeti Bitir")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Assistant;
