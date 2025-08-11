import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useLanguage } from "./LanguageContext";
import { FiArrowLeft } from "react-icons/fi";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const [log, setLog] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/sessionlogs/${id}`);
        if (!ignore) setLog(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  const transcript = React.useMemo(() => {
    const arr = Array.isArray(log?.transcript) ? log.transcript : [];
    return arr
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object") return x.text ?? JSON.stringify(x);
        return "";
      })
      .filter(Boolean);
  }, [log]);

  async function handleDownloadPdf() {
    try {
      const res = await api.get(`/sessionlogs/${id}/summary-pdf`, {
        params: { lang: language === "tr" ? "tr" : "en" },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const header =
        res.headers["content-disposition"] ||
        res.headers["Content-Disposition"];
      let filename = "Gorusme_Ozeti.pdf";
      if (header) {
        const mStar = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
        if (mStar && mStar[1]) {
          try {
            filename = decodeURIComponent(mStar[1]);
          } catch {}
        } else {
          const m = header.match(/filename="?([^"]+)"?/i);
          if (m && m[1]) filename = m[1];
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(t("PDF download failed.", "PDF indirme başarısız."));
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 840, margin: "0 auto" }}>
      <style>
        {`
          .transcript-scroll {
            max-height: 68vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--border-card) var(--bg-main);
          }
          .transcript-scroll::-webkit-scrollbar {
            width: 8px;
            background: var(--bg-main);
          }
          .transcript-scroll::-webkit-scrollbar-thumb {
            background: var(--border-card);
            border-radius: 10px;
          }
        `}
      </style>

      <button
        onClick={() => navigate("/sessions")}
        style={{
          background: "var(--accent-muted, #213049)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "10px 16px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 18,
        }}
      >
        <FiArrowLeft /> {t("Back to Sessions", "Kayıtlara Dön")}
      </button>

      <h2 style={{ marginBottom: 12 }}>
        {t("Session Transcript", "Görüşme Transkripti")} #{id}
      </h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => navigate(`/sessions/${id}/summary`)}
          style={btn("primary")}
        >
          {t("View Summary", "Özeti Gör")}
        </button>
        <button onClick={handleDownloadPdf} style={btn("outline")}>
          {t("Download Summary PDF", "Özet PDF İndir")}
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#9aa3b2" }}>
          {t("Loading...", "Yükleniyor...")}
        </div>
      ) : !log ? (
        <div style={{ color: "#c55" }}>{t("Not found.", "Bulunamadı.")}</div>
      ) : (
        <div
          className="transcript-scroll"
          style={{
            background: "var(--card-bg, #1f2433)",
            border: "1px solid var(--card-border, #2a3042)",
            borderRadius: 12,
            padding: 18,
            boxShadow: "0 6px 18px rgba(0,0,0,.12)",
          }}
        >
          {transcript.length === 0 ? (
            <div style={{ color: "#9aa3b2" }}>
              {t("No transcript.", "Transkript boş.")}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {transcript.map((line, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid #313a54",
                    borderRadius: 8,
                    padding: "10px 12px",
                    lineHeight: 1.4,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 13, color: "#9aa3b2" }}>
            {t("Created At:", "Oluşturma:")}{" "}
            {log.created_at
              ? new Date(log.created_at).toLocaleString("tr-TR")
              : "-"}
          </div>
        </div>
      )}
    </div>
  );
}

function btn(variant = "primary") {
  const base = {
    borderRadius: 10,
    padding: "9px 14px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    border: "1px solid transparent",
  };
  if (variant === "primary") {
    return {
      ...base,
      background:
        "linear-gradient(135deg, var(--btn1,#5c93f7), var(--btn2,#4285f4))",
      color: "#fff",
      boxShadow: "0 1px 8px rgba(66,133,244,.35)",
    };
  }
  if (variant === "outline") {
    return {
      ...base,
      background: "transparent",
      color: "#cfe0ff",
      border: "1px solid #3b4663",
    };
  }
  return {
    ...base,
    background: "#222a3d",
    color: "#e9efff",
    border: "1px solid #2e3752",
  };
}
