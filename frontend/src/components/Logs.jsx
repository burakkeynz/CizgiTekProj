import React from "react";
import { useNavigate } from "react-router-dom";

function getFirstQuestionAnswer(messages) {
  const filtered = (messages || []).filter(
    (m) =>
      (m.role === "user" || m.role === "model") &&
      m.text &&
      m.text !== "Merhaba! Size nasıl yardımcı olabilirim?"
  );

  const firstUserIdx = filtered.findIndex((m) => m.role === "user");
  const firstQ = firstUserIdx !== -1 ? filtered[firstUserIdx]?.text : "";

  const firstAObj = filtered.find(
    (m, i) => m.role === "model" && i > firstUserIdx
  );
  const firstA = firstAObj?.text || "";

  let hasMore = false;
  if (firstUserIdx !== -1) {
    const afterFirstAIdx =
      firstAObj && filtered.indexOf(firstAObj) !== -1
        ? filtered.indexOf(firstAObj) + 1
        : firstUserIdx + 1;
    hasMore = filtered.slice(afterFirstAIdx).length > 0;
  }

  return { firstQ, firstA, hasMore };
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

function Logs({ logs, onDelete }) {
  const navigate = useNavigate();

  return (
    <>
      <style>
        {`
        .logs-scrollable {
          scrollbar-width: thin;
          scrollbar-color: var(--border-card) var(--bg-main);
        }
        .logs-scrollable::-webkit-scrollbar {
          width: 7px;
          background: var(--bg-main);
        }
        .logs-scrollable::-webkit-scrollbar-thumb {
          background: var(--border-card);
          border-radius: 10px;
        }
        .logs-scrollable::-webkit-scrollbar-thumb:hover {
          background: var(--accent-muted);
        }
        .log-card {
          transition: box-shadow .15s, background .12s;
          cursor: pointer;
          background: var(--card-bg);
          border: 1.2px solid var(--border-card);
          border-radius: 18px;
          box-shadow: var(--shadow-card);
          padding: 22px;
          min-width: 320px;
          max-width: 740px;
          font-size: 16px;
          position: relative;
          user-select: none;
        }
        .log-card:hover {
          background: var(--nav-bg-hover);
          box-shadow: 0 6px 20px var(--shadow-card);
        }
        .log-delete-btn {
          transition: background .13s;
        }
        .log-delete-btn:hover {
          background: #fbe4e4;
        }
        .log-more {
          color: var(--text-muted);
          font-size: 21px;
          text-align: center;
          letter-spacing: 6px;
          margin-top: 8px;
          font-weight: 700;
        }
        .log-q-label {
          color: var(--accent-hover);
          font-weight: 600;
        }
        .log-q-text {
          color: var(--text-label);
          font-weight: 500;
          margin-left: 8px;
        }
        .log-a-label {
          color: var(--accent-color);
          font-weight: 600;
        }
        .log-a-text {
          color: var(--text-main);
          font-weight: 500;
          margin-left: 8px;
        }
        `}
      </style>
      <div
        className="logs-scrollable"
        style={{
          padding: 32,
          height: "100vh",
          overflowY: "auto",
          background: "var(--bg-main)",
          transition: "background 0.2s, color 0.2s",
        }}
      >
        <h2
          style={{
            fontWeight: 700,
            fontSize: 26,
            color: "var(--text-main)",
            marginBottom: 18,
          }}
        >
          Chat Geçmişi
        </h2>
        {logs.length === 0 && (
          <div
            style={{ color: "var(--text-muted)", fontSize: 17, marginTop: 30 }}
          >
            Hiç log yok.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {logs.map((log, idx) => {
            const { firstQ, firstA, hasMore } = getFirstQuestionAnswer(
              log.messages
            );
            return (
              <div
                key={log.id}
                onClick={() => navigate("/logs/" + log.id)}
                className="log-card"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    navigate(`/logs/${log.id}`);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    style={{
                      color: "var(--accent-hover)",
                      fontWeight: 600,
                      fontSize: 16,
                      letterSpacing: 0.1,
                    }}
                  >
                    {idx + 1} -{" "}
                    <span
                      style={{
                        textDecoration: "underline",
                        fontWeight: 500,
                        color: "var(--text-label)",
                      }}
                    >
                      {firstQ?.substring(0, 32) || "Soru yok"}
                      {firstQ.length > 32 ? "..." : ""}
                    </span>
                  </span>
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 400,
                      fontSize: 14,
                      marginLeft: 14,
                    }}
                  >
                    - {formatDate(log.created_at)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(log.id);
                    }}
                    className="log-delete-btn"
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
                    }}
                    title="Kaydı sil"
                  >
                    ×
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <span className="log-q-label">Soru:</span>
                  <span className="log-q-text">{firstQ}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className="log-a-label">Cevap:</span>
                  <span className="log-a-text">{firstA}</span>
                </div>
                {hasMore && <div className="log-more">...</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default Logs;
