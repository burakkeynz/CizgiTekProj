import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiUpload, FiArrowRight, FiX } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import api from "../api";

// Daha güvenli sessionStorage key:
const SESSION_KEY = "ai_assistang_logs:";

// Başlangıç mesajı:
const INITIAL_MSG = [
  {
    role: "model",
    text: "Merhaba! Size nasıl yardımcı olabilirim?",
  },
];
function DotLoader() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 32,
      }}
    >
      <span className="dot">.</span>
      <span className="dot">.</span>
      <span className="dot">.</span>
      <style>
        {`
          .dot {
            animation: blink 1.4s infinite both;
            font-size: 22px;
          }
          .dot:nth-child(2) {
            animation-delay: .2s;
          }
          .dot:nth-child(3) {
            animation-delay: .4s;
          }
          @keyframes blink {
            0% { opacity: .1; }
            20% { opacity: 1; }
            100% { opacity: .1; }
          }
        `}
      </style>
    </span>
  );
}

function Assistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ai_assistant_open");
      return saved === null ? true : JSON.parse(saved);
    } catch {
      return true;
    }
  });

  useEffect(() => {
    sessionStorage.setItem("ai_assistant_open", JSON.stringify(isOpen));
  }, [isOpen]);

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : INITIAL_MSG;
    } catch {
      return INITIAL_MSG;
    }
  });

  useEffect(() => {
    // f5 veya baska sayfa geçişinde sayfa kapatmak için
    setIsOpen(false);
    sessionStorage.setItem("ai_assistant_open", JSON.stringify(false));
  }, [location]);

  // Diğer state’ler:
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null); // search, upload null olabiliyor
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);

  //effect for message updates
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // panel kapama
  const handleClose = () => setIsOpen(false);

  //baloncuk
  if (!isOpen) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 32,
          zIndex: 50,
          // maxWidth: "96%",
          // minWidth: 320,
          cursor: "pointer",
          background: "#0066ff",
          color: "#fff",
          borderRadius: "50%",
          width: 54,
          height: 54,
          boxShadow: "0 3px 18px #0066ff33",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          fontWeight: "bold",
        }}
        onClick={() => setIsOpen(true)}
        title="AI Asistan'ı aç"
      >
        💬
      </div>
    );
  }

  const handleEndDiscussion = async () => {
    try {
      const logs = sessionStorage.getItem(SESSION_KEY);
      if (logs && JSON.parse(logs).length > 1) {
        await api.post("/chatlogs/", {
          messages: JSON.parse(logs),
          ended_at: new Date().toISOString(),
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
    if (loading || (!input.trim() && !selectedFile)) return;
    setLoading(true);

    let userMsg;
    let updatedMessages = [...messages];

    if (activeTool === "upload" && selectedFile) {
      const file = selectedFile;
      const fileBytes = await file.arrayBuffer();
      const base64Data = btoa(
        new Uint8Array(fileBytes).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      userMsg = {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
        ],
      };
      if (input.trim()) {
        userMsg.parts.push({ text: input });
      }
      setSelectedFile(null);
      setInput("");
    } else {
      userMsg = {
        role: "user",
        parts: [{ text: input }],
      };
      setInput("");
    }

    const contents = updatedMessages.map((msg) =>
      msg.role === "user" || msg.role === "model"
        ? {
            role: msg.role,
            parts: msg.parts ? msg.parts : [{ text: msg.text }],
          }
        : msg
    );
    contents.push(userMsg);

    setMessages([
      ...updatedMessages,
      {
        role: "user",
        text: input || (selectedFile && selectedFile.name) || "Dosya",
        ...(userMsg.parts && { parts: userMsg.parts }),
      },
      {
        role: "model",
        text: "...", // loader text
        isLoader: true, // loader flag
      },
    ]);

    try {
      let payload = { contents };
      if (activeTool === "search") {
        payload.web_search = true;
      }
      const res = await api.post("/gemini/chat", payload);
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

  return (
    <div
      style={{
        position: "absolute",
        bottom: 4,
        right: 16,
        left: 16,
        zIndex: 50,
        maxWidth: "calc(100% - 32px)",
        border: "1px solid #eee",
        borderRadius: 16,
        background: "#f8fafc",
        boxShadow: "0 2px 12px #cbd5e166",
        display: "flex",
        flexDirection: "column",
        height: 475,
        minWidth: 320,
      }}
    >
      <div
        style={{
          background: "#0066ff",
          color: "#fff",
          padding: "14px 0",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          textAlign: "center",
          fontWeight: "bold",
          fontSize: 18,
          position: "relative",
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
          title="Kapat"
        >
          <FiX size={22} />
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              background: msg.role === "user" ? "#e0f7fa" : "#e3e8f5",
              color: "#222",
              padding: "8px 14px",
              borderRadius: 12,
              maxWidth: "78%",
              whiteSpace: "pre-wrap",
              fontSize: 15,
              minHeight: msg.isLoader ? 28 : undefined,
              display: "flex",
              alignItems: "center",
            }}
          >
            {msg.isLoader ? (
              // Basit loader veya animasyonlu:
              <span
                style={{
                  letterSpacing: 3,
                  fontWeight: 600,
                  fontSize: 21,
                }}
              >
                <DotLoader />
              </span>
            ) : (
              msg.text
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Araç çubuğu */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "4px 9px 4px 9px",
          borderTop: "1px solid #e8eaf1",
          background: "#f8fafc",
        }}
      >
        {/* ... Web search ve Dosya Yükle butonları */}
        <button
          onClick={() =>
            setActiveTool(activeTool === "search" ? null : "search")
          }
          style={{
            background: activeTool === "search" ? "#fff" : "#f3f6fa",
            border:
              activeTool === "search"
                ? "1.5px solid #0066ff"
                : "1px solid #e1e6ef",
            color: activeTool === "search" ? "#0066ff" : "#444",
            padding: "4px 10px 4px 7px",
            borderRadius: 7,
            fontSize: 13.7,
            display: "flex",
            alignItems: "center",
            fontWeight: 500,
            boxShadow: activeTool === "search" ? "0 1px 4px #0066ff15" : "none",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          title="Web Search"
        >
          <FiSearch size={15} style={{ marginRight: 6 }} />
          Web Search
        </button>

        <label
          htmlFor="file-upload"
          style={{
            background: activeTool === "upload" ? "#fff" : "#f3f6fa",
            border:
              activeTool === "upload"
                ? "1.5px solid #0066ff"
                : "1px solid #e1e6ef",
            color: activeTool === "upload" ? "#0066ff" : "#444",
            padding: "4px 10px 4px 7px",
            borderRadius: 7,
            fontSize: 13.7,
            display: "flex",
            alignItems: "center",
            fontWeight: 500,
            boxShadow: activeTool === "upload" ? "0 1px 4px #0066ff15" : "none",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          title="Dosya Yükle"
        >
          <FiUpload size={15} style={{ marginRight: 6 }} />
          Dosya Yükle
          <input
            id="file-upload"
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              setActiveTool("upload");
              setSelectedFile(e.target.files?.[0]);
            }}
          />
        </label>
        {selectedFile && (
          <span
            style={{
              marginLeft: 3,
              color: "#0066ff",
              fontSize: 12.3,
              fontWeight: 500,
            }}
          >
            {selectedFile.name}
          </span>
        )}
      </div>

      {/* Input ve End Discussion */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderTop: "1px solid #eee",
          background: "#fff",
          padding: 8,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          disabled={loading}
          rows={1}
          placeholder="Asistan'a sorun."
          style={{
            flex: 1,
            resize: "none",
            border: "none",
            outline: "none",
            fontSize: 16,
            padding: 10,
            background: "#f8fafc",
            borderRadius: 8,
            marginRight: 6,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && !selectedFile)}
          style={{
            background: "#0066ff",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 5,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px #0066ff14",
            fontSize: 21,
            transition: "background 0.14s",
          }}
          title="Gönder"
        >
          <FiArrowRight size={20} />
        </button>
        {/* End Discussion */}
        <button
          onClick={handleEndDiscussion}
          style={{
            marginLeft: 9,
            fontSize: 13,
            color: "#555",
            border: "1px solid #c0c4cc",
            borderRadius: 7,
            padding: "7px 13px",
            background: "#f8fafc",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          End Discussion
        </button>
      </div>
    </div>
  );
}

export default Assistant;
