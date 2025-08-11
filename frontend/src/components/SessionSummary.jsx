import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useLanguage } from "./LanguageContext";
import { FiArrowLeft } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatTR(iso) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso || "-";
  }
}

export default function SessionSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const [summary, setSummary] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [meta, setMeta] = React.useState(null);

  async function fetchMeta() {
    try {
      const res = await api.get(`/sessionlogs/${id}`);
      setMeta(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchSummary(force = false) {
    setLoading(true);
    setError("");
    try {
      const res = await api.post(`/sessionlogs/${id}/summarize`, {
        lang: language === "tr" ? "tr" : "en",
        force,
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
    fetchMeta();
    fetchSummary(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, language]);

  function handleCopy() {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
  }

  async function handleDownloadPdf(force = false) {
    try {
      const res = await api.get(`/sessionlogs/${id}/summary-pdf`, {
        params: { lang: language === "tr" ? "tr" : "en", force },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Gorusme_Ozeti.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(t("PDF download failed.", "PDF indirme başarısız."));
    }
  }

  return (
    <>
      <style>{`
        .report-root { padding: 32px; max-width: 960px; margin: 0 auto; }
        .report-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }
        .report-header {
          padding: 18px 20px;
          border-bottom: 1px solid var(--card-border);
          background: linear-gradient(0deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
        }
        .report-title { margin: 0; color: var(--text-main); font-size: 22px; font-weight: 800; letter-spacing: .2px; }
        .report-sub { margin-top: 4px; font-size: 13px; color: var(--text-muted); }
        .report-body { padding: 18px 20px; }

        .meta-table { display: grid; grid-template-columns: 180px 1fr; row-gap: 6px; }
        .meta-label { color: var(--text-muted); font-size: 13px; }
        .meta-value { color: #dfe6f3; font-weight: 600; }

        .section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--card-border); }
        .section h3 { margin: 0 0 10px; font-size: 16px; letter-spacing: .3px; color: var(--text-main); text-transform: uppercase; }

        .markdown p { margin: 0 0 10px; color: #dfe6f3; }
        .markdown ul, .markdown ol { margin: 0 0 8px; padding-left: 22px; }
        .markdown li { margin: 4px 0; }
        .markdown strong { font-weight: 800; }

        .btn { border-radius: 10px; padding: 9px 14px; font-weight: 700; font-size: 14px; cursor: pointer; border: 1px solid transparent; }
        .btn-primary { background: linear-gradient(135deg, var(--btn1,#5c93f7), var(--btn2,#4285f4)); color: #fff; box-shadow: 0 1px 8px rgba(66,133,244,.35); }
        .btn-ghost { background: #222a3d; color: #e9efff; border: 1px solid #2e3752; }
        .btn-outline { background: transparent; color: #cfe0ff; border: 1px solid #3b4663; }
      `}</style>

      <div className="report-root">
        <button
          onClick={() => navigate("/sessions")}
          style={{
            background: "var(--accent-muted)",
            color: "var(--accent-color)",
            border: "none",
            borderRadius: 10,
            padding: "10px 16px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 18,
            fontWeight: 600,
          }}
        >
          <FiArrowLeft /> {t("Back to Sessions", "Kayıtlara Dön")}
        </button>

        <div className="report-card">
          <div className="report-header">
            <h1 className="report-title">
              {t("Session Summary", "Görüşme Özeti")} #{id}
            </h1>
            {meta && (
              <div className="report-sub">
                {t("Generated", "Oluşturulma")} • {formatTR(meta?.created_at)}
              </div>
            )}
          </div>

          <div className="report-body">
            {/* Meta tablo */}
            <div className="meta-table">
              <div className="meta-label">
                {t("Participants", "Katılımcılar")}
              </div>
              <div className="meta-value">
                {meta?.user1_name || "-"} • {meta?.user2_name || "-"}
              </div>

              <div className="meta-label">{t("Date/Time", "Tarih/Saat")}</div>
              <div className="meta-value">
                {meta?.session_time_stamp
                  ? formatTR(meta.session_time_stamp)
                  : "-"}
              </div>
            </div>

            {/* Özet (Markdown) */}
            <div className="section markdown">
              {error ? (
                <div style={{ color: "#e57373", marginBottom: 10 }}>
                  {error}
                </div>
              ) : loading ? (
                t("Generating summary...", "Özet oluşturuluyor...")
              ) : summary ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {summary}
                </ReactMarkdown>
              ) : (
                t("No summary yet.", "Henüz özet yok.")
              )}
            </div>

            {/* Aksiyonlar */}
            <div className="section" style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => fetchSummary(true)}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading
                  ? t("Generating...", "Oluşturuluyor...")
                  : t("Refresh Summary", "Özeti Yenile")}
              </button>
              <button
                onClick={handleCopy}
                className="btn btn-ghost"
                disabled={!summary}
              >
                {t("Copy", "Kopyala")}
              </button>
              {summary && (
                <button
                  onClick={() => handleDownloadPdf(false)}
                  className="btn btn-outline"
                >
                  {t("Download PDF", "PDF İndir")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
