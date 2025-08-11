import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useLanguage } from "./LanguageContext";
import { FiArrowLeft } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatTR(iso) {
  try {
    if (!iso) return "-";
    let s = String(iso).trim().replace(" ", "T");
    if (!/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) s += "Z";
    const d = new Date(s);
    if (isNaN(d)) return iso || "-";
    return d.toLocaleString("tr-TR", {
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

const stripSquareTags = (s) => (s || "").replace(/\[[^\]]+\]/g, "").trim();

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

  // Transkripti rapor başlığı + bullet list olarak markdown’a dök
  const transcriptMd = React.useMemo(() => {
    const parts = Array.isArray(log?.transcript) ? log.transcript : [];
    const lines = parts
      .map((x) => (typeof x === "string" ? x : x?.text ?? ""))
      .map(stripSquareTags)
      .filter(Boolean);

    if (lines.length === 0) return "";

    const bullets = lines.map((s) => `- ${s}`).join("\n");
    const title = t("### Transcript", "### Transkript Dökümü");
    return `${title}\n\n${bullets}`;
  }, [log, language]);

  async function handleDownloadPdf() {
    try {
      const res = await api.get(`/sessionlogs/${id}/summary-pdf`, {
        params: { lang: language === "tr" ? "tr" : "en" },
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
        /* Scrollable orta alan — Sessions.jsx ile aynı */
        .sessions-scrollable {
          height: 100vh;
          overflow-y: auto;
          padding: 24px;
          background: var(--bg-main);
        }
        .sessions-scrollable {
          scrollbar-width: thin;
          scrollbar-color: var(--border-card) var(--bg-main);
        }
        .sessions-scrollable::-webkit-scrollbar {
          width: 7px;
          background: var(--bg-main);
        }
        .sessions-scrollable::-webkit-scrollbar-thumb {
          background: var(--border-card);
          border-radius: 10px;
        }
        .sessions-scrollable::-webkit-scrollbar-thumb:hover {
          background: var(--accent-muted);
        }

        .report-root { max-width: 960px; margin: 0 auto; }
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
        .report-title {
          margin: 0;
          color: var(--text-main);
          font-size: 22px;
          font-weight: 800;
          letter-spacing: .2px;
        }
        .report-body { padding: 18px 20px; }

        /* Meta tablo: label kolon sabit genişlik, değer esnek */
        .meta-table { display: grid; grid-template-columns: 180px 1fr; row-gap: 6px; }
        .meta-label { color: var(--text-muted); font-size: 13px; }
        .meta-value { color: #dfe6f3; font-weight: 600; }

        .section {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--card-border);
        }
        .section h3 {
          margin: 0 0 10px;
          font-size: 16px;
          letter-spacing: .3px;
          color: var(--text-main);
          text-transform: uppercase;
        }

        /* Markdown tipografi (rapor görünümü) */
        .markdown p { margin: 0 0 10px; color: #dfe6f3; }
        .markdown ul, .markdown ol { margin: 0 0 8px; padding-left: 22px; }
        .markdown li { margin: 4px 0; }
        .markdown strong { font-weight: 800; }

        .btn { border-radius: 10px; padding: 9px 14px; font-weight: 700; font-size: 14px; cursor: pointer; border: 1px solid transparent; }
        .btn-primary { background: linear-gradient(135deg, var(--btn1,#5c93f7), var(--btn2,#4285f4)); color: #fff; box-shadow: 0 1px 8px rgba(66,133,244,.35); }
        .btn-outline { background: transparent; color: #cfe0ff; border: 1px solid #3b4663; }
      `}</style>

      <div className="sessions-scrollable">
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
                {t("Session Transcript", "Görüşme Transkripti")}
              </h1>
              {/* Oluşturma/Generated satırı kaldırıldı */}
            </div>

            <div className="report-body">
              {loading ? (
                <div style={{ color: "var(--text-muted)" }}>
                  {t("Loading...", "Yükleniyor...")}
                </div>
              ) : !log ? (
                <div style={{ color: "#c55" }}>
                  {t("Not found.", "Bulunamadı.")}
                </div>
              ) : (
                <>
                  {/* Meta tablo */}
                  <div className="meta-table">
                    <div className="meta-label">
                      {t("Participants", "Katılımcılar")}
                    </div>
                    <div className="meta-value">
                      {log.user1_name || "-"} • {log.user2_name || "-"}
                    </div>

                    <div className="meta-label">
                      {t("Date/Time", "Tarih/Saat")}
                    </div>
                    <div className="meta-value">
                      {formatTR(log.session_time_stamp)}
                    </div>
                  </div>

                  {/* Transkript bölümü */}
                  <div className="section markdown">
                    {transcriptMd ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {transcriptMd}
                      </ReactMarkdown>
                    ) : (
                      <div style={{ color: "var(--text-muted)" }}>
                        {t("No transcript.", "Transkript boş.")}
                      </div>
                    )}
                  </div>

                  <div className="section" style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => navigate(`/sessions/${id}/summary`)}
                      className="btn btn-primary"
                    >
                      {t("View Summary", "Özeti Gör")}
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      className="btn btn-outline"
                    >
                      {t("Download Summary PDF", "Özet PDF İndir")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
