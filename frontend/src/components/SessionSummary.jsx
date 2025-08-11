import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useLanguage } from "./LanguageContext";
import { FiArrowLeft } from "react-icons/fi";

export default function SessionSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const [summary, setSummary] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function fetchSummary() {
    setLoading(true);
    setError("");
    try {
      const res = await api.post(`/sessionlogs/${id}/summarize`, {
        lang: language === "tr" ? "tr" : "en",
      });
      setSummary(res.data?.summary || "");
    } catch (e) {
      console.error(e);
      setError(
        t(
          "Summary failed or endpoint missing.",
          "Özet başarısız oldu ya da uç nokta yok."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line
  }, [id, language]);

  function handleCopy() {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
  }

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
        {t("Session Summary", "Görüşme Özeti")} #{id}
      </h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchSummary}
          style={btn("primary")}
          disabled={loading}
        >
          {loading
            ? t("Refreshing...", "Yenileniyor...")
            : t("Refresh Summary", "Özeti Yenile")}
        </button>
        <button onClick={handleCopy} style={btn("ghost")} disabled={!summary}>
          {t("Copy", "Kopyala")}
        </button>
        <button onClick={handleDownloadPdf} style={btn("outline")}>
          {t("Download PDF", "PDF İndir")}
        </button>
      </div>

      {error && (
        <div style={{ color: "#e57373", marginBottom: 10 }}>{error}</div>
      )}

      <div
        style={{
          background: "var(--card-bg, #1f2433)",
          border: "1px solid var(--card-border, #2a3042)",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 6px 18px rgba(0,0,0,.12)",
          whiteSpace: "pre-wrap",
          minHeight: 140,
          color: "#dfe6f3",
        }}
      >
        {loading
          ? t("Generating summary...", "Özet oluşturuluyor...")
          : summary || t("No summary yet.", "Henüz özet yok.")}
      </div>
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
