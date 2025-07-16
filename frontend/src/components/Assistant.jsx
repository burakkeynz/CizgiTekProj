import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiUpload, FiArrowRight } from "react-icons/fi";
import api from "../api";

function Assistant() {
  const [messages, setMessages] = useState([
    {
      role: "model",
      text: "Merhaba! Size nasıl yardımcı olabilirim?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null); // search, upload null olabiliyor
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (loading || (!input.trim() && !selectedFile)) return;

    setLoading(true);

    let userMsg;
    let updatedMessages = [...messages];

    if (activeTool === "upload" && selectedFile) {
      // Dosyayı base64 encode et
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
    ]);

    try {
      let payload = { contents };
      // Web Search aktifse ekle
      if (activeTool === "search") {
        payload.web_search = true;
      }
      const res = await api.post("/gemini/chat", payload);
      const responseText =
        res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt yok";
      setMessages((msgs) => [...msgs, { role: "model", text: responseText }]);
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        {
          role: "model",
          text: "Bir hata oluştu, lütfen tekrar deneyin.",
        },
      ]);
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
        maxWidth: 480,
        margin: "40px auto",
        border: "1px solid #eee",
        borderRadius: 16,
        background: "#f8fafc",
        boxShadow: "0 2px 12px #cbd5e166",
        display: "flex",
        flexDirection: "column",
        height: 520,
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
        }}
      >
        AI-Assistant
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
            }}
          >
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

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
      </div>
    </div>
  );
}

export default Assistant;
