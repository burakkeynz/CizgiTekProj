import React, { useEffect, useState } from "react";
import api from "../api";

function getFirstQuestionAnswer(messages) {
  const filtered = (messages || []).filter(
    (m) =>
      (m.role === "user" || m.role === "model") &&
      m.text &&
      m.text !== "Merhaba! Size nasıl yardımcı olabilirim?"
  );
  const firstQ = filtered.find((m) => m.role === "user")?.text || "";
  const firstA =
    filtered.find(
      (m, i) =>
        m.role === "model" && i > filtered.findIndex((x) => x.role === "user")
    )?.text || "";
  return { firstQ, firstA };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Logs() {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    fetchLogs();
  }, []);
  const fetchLogs = async () => {
    try {
      const res = await api.get("/chatlogs/");
      setLogs(res.data);
    } catch (e) {}
  };
  const handleDelete = async (id) => {
    try {
      await api.delete(`/chatlogs/${id}`);
      setLogs((prev) => prev.filter((log) => log.id !== id));
    } catch {}
  };

  return (
    <div style={{ padding: 32 }}>
      <h2
        style={{
          fontWeight: 700,
          fontSize: 26,
          color: "#253046",
          marginBottom: 18,
        }}
      >
        Chat Geçmişi
      </h2>
      {logs.length === 0 && (
        <div style={{ color: "#7a879a", fontSize: 17, marginTop: 30 }}>
          Hiç log yok.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {logs.map((log, idx) => {
          const { firstQ, firstA } = getFirstQuestionAnswer(log.messages);
          return (
            <div
              key={log.id}
              style={{
                background: "#fafdff",
                border: "1.2px solid #e4e9f3",
                borderRadius: 18,
                boxShadow: "0 2px 16px #dde5fa23",
                padding: 22,
                minWidth: 320,
                maxWidth: 740,
                fontSize: 16,
                transition: "box-shadow .15s",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    color: "#2273c5",
                    fontWeight: 600,
                    fontSize: 16,
                    letterSpacing: 0.1,
                  }}
                >
                  {idx + 1} -{" "}
                  <span
                    style={{ textDecoration: "underline", fontWeight: 500 }}
                  >
                    {firstQ?.substring(0, 32) || "Soru yok"}
                    {firstQ.length > 32 ? "..." : ""}
                  </span>
                </span>
                <span
                  style={{
                    color: "#7a879a",
                    fontWeight: 400,
                    fontSize: 14,
                    marginLeft: 14,
                  }}
                >
                  - {formatDate(log.created_at)}
                </span>
                <button
                  onClick={() => handleDelete(log.id)}
                  style={{
                    marginLeft: "auto",
                    border: "none",
                    background: "none",
                    color: "#ea5a5a",
                    fontSize: 22,
                    cursor: "pointer",
                    borderRadius: 10,
                    padding: "0 8px",
                    fontWeight: 700,
                    transition: "background .13s",
                  }}
                  title="Kaydı sil"
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "#fbe4e4")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "none")
                  }
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <span style={{ color: "#2273c5", fontWeight: 500 }}>Soru:</span>
                <span
                  style={{ color: "#23272f", fontWeight: 400, marginLeft: 8 }}
                >
                  {firstQ}
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ color: "#2273c5", fontWeight: 500 }}>
                  Cevap:
                </span>
                <span
                  style={{ color: "#24446b", fontWeight: 400, marginLeft: 8 }}
                >
                  {firstA}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Logs;
