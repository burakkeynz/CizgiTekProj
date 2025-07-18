import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiUpload, FiArrowRight, FiX } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import api from "../api";

const SESSION_KEY = "ai_assistang_logs:";
const INITIAL_MSG = [
  {
    role: "model",
    text: "Merhaba! Size nasıl yardımcı olabilirim?",
  },
];

function DotLoader() {
  return (
    <span style={{ display: "inline-block", width: 32 }}>
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
    // sayfa geçişinde kapansın
    setIsOpen(false);
    sessionStorage.setItem("ai_assistant_open", JSON.stringify(false));
  }, [location]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleClose = () => setIsOpen(false);

  if (!isOpen) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 32,
          zIndex: 50,
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
        text: "...",
        isLoader: true,
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
        width: "100%",
        height: 475,
        maxHeight: 480,
        background: "#f8fafc",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        border: "1px solid #e4e4e4",
        boxShadow: "0 -2px 10px #00000008",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          background: "#0066ff",
          color: "#fff",
          padding: "12px 0",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          textAlign: "center",
          fontWeight: "bold",
          fontSize: 18,
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
            {msg.isLoader ? <DotLoader /> : msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Tool & input */}
      <div style={{ padding: 10, borderTop: "1px solid #e0e0e0" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <button
            onClick={() => setActiveTool("search")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              fontSize: 13,
              borderRadius: 6,
              background: activeTool === "search" ? "#0066ff" : "#f1f1f1",
              color: activeTool === "search" ? "#fff" : "#333",
              border: "none",
              cursor: "pointer",
            }}
          >
            <FiSearch />
            Web Search
          </button>

          <label
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              fontSize: 13,
              borderRadius: 6,
              background: activeTool === "upload" ? "#0066ff" : "#f1f1f1",
              color: activeTool === "upload" ? "#fff" : "#333",
              border: "none",
              cursor: "pointer",
            }}
          >
            <FiUpload />
            Dosya Yükle
            <input
              type="file"
              style={{ display: "none" }}
              onChange={(e) => {
                setSelectedFile(e.target.files[0]);
                setActiveTool("upload");
              }}
            />
          </label>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          disabled={loading}
          placeholder="Asistan'a sorun..."
          rows={2}
          style={{
            width: "100%",
            resize: "none",
            borderRadius: 8,
            padding: 8,
            border: "1px solid #ccc",
            fontSize: 14,
            marginBottom: 8,
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
              background: "#0066ff",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 0",
              fontWeight: 500,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Gönder
          </button>
          <button
            onClick={handleEndDiscussion}
            style={{
              flex: 1,
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: "8px 0",
              fontSize: 14,
              background: "#fff",
              cursor: "pointer",
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
