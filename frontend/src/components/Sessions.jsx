import React from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "./LanguageContext";
import api from "../api";

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString("tr-TR");
  } catch {
    return ts || "";
  }
}

function getFilenameFromContentDisposition(header) {
  if (!header) return null;
  const mStar = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (mStar && mStar[1]) {
    try {
      return decodeURIComponent(mStar[1].replace(/(^")|("$)/g, ""));
    } catch {
      return mStar[1].replace(/(^")|("$)/g, "");
    }
  }

  const m = header.match(/filename="?([^"]+)"?/i);
  return m && m[1] ? m[1] : null;
}

export default function Sessions({ currentUser }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const [summaries, setSummaries] = React.useState({});
  const [sumLoading, setSumLoading] = React.useState({});

  const [expanded, setExpanded] = React.useState({});

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/sessionlogs");
        if (!ignore) setItems(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  function handleShow(id) {
    navigate(`/sessions/${id}`);
  }

  function handleOpenSummary(id) {
    navigate(`/sessions/${id}/summary`);
  }

  async function handleSummarizeInline(id) {
    setSumLoading((s) => ({ ...s, [id]: true }));
    try {
      const res = await api.post(`/sessionlogs/${id}/summarize`, {
        lang: language === "tr" ? "tr" : "en",
      });
      const summary = res.data?.summary || "";
      setSummaries((m) => ({ ...m, [id]: summary }));
    } catch (e) {
      console.error(e);
      alert(
        t(
          "Summary endpoint not available or failed.",
          "Özetleme uç noktası yok ya da hata oluştu."
        )
      );
    } finally {
      setSumLoading((s) => ({ ...s, [id]: false }));
    }
  }

  async function handleDownloadSummaryPdf(id) {
    try {
      const res = await api.get(`/sessionlogs/${id}/summary-pdf`, {
        params: { lang: language === "tr" ? "tr" : "en" },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });

      // Sunucunun verdiği adı kullan (UTF-8 filename* destekli)
      const header =
        res.headers["content-disposition"] ||
        res.headers["Content-Disposition"];
      const serverName = getFilenameFromContentDisposition(header);
      const fallback = `Gorusme_Ozeti_${id}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = serverName || fallback;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(t("PDF download failed.", "PDF indirme başarısız."));
    }
  }

  async function handleDelete(id) {
    if (
      !window.confirm(
        t("Delete this session?", "Bu kaydı silmek istiyor musun?")
      )
    )
      return;
    try {
      await api.delete(`/sessionlogs/${id}`);
      setItems((arr) => arr.filter((x) => String(x.id) !== String(id)));
      // inline özet varsa temizle
      setSummaries((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
    } catch (e) {
      console.error(e);
      alert(t("Delete failed.", "Silme başarısız."));
    }
  }

  function transcriptToLines(tr) {
    const arr = Array.isArray(tr) ? tr : [];
    return arr
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object") return x.text ?? JSON.stringify(x);
        return "";
      })
      .filter(Boolean);
  }

  return (
    <div style={{ padding: 24 }}>
      <style>
        {`
          .session-preview {
            background: rgba(255,255,255,0.03);
            border: 1px solid #3a425a;
            border-radius: 10px;
            padding: 10px;
            white-space: pre-wrap;
            transition: max-height .2s ease;
            overflow: hidden;
          }
          .session-preview.scrollable {
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--border-card) transparent;
          }
          .session-preview::-webkit-scrollbar {
            width: 7px;
            background: transparent;
          }
          .session-preview::-webkit-scrollbar-thumb {
            background: var(--border-card);
            border-radius: 10px;
          }
          .session-actions button { margin-left: 0 !important; }
        `}
      </style>

      <h2 style={{ marginBottom: 14 }}>{t("Sessions", "Görüşme Kayıtları")}</h2>

      {loading ? (
        <div style={{ color: "#889" }}>{t("Loading...", "Yükleniyor...")}</div>
      ) : items.length === 0 ? (
        <div style={{ color: "#889" }}>
          {t("No sessions yet.", "Henüz kayıt yok.")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            maxWidth: 820,
          }}
        >
          {items.map((it) => {
            const peerId =
              String(it.user1_id) === String(currentUser?.id)
                ? it.user2_id
                : it.user1_id;

            const lines = transcriptToLines(it.transcript);
            const joined = lines.join("\n");
            const isExpanded = !!expanded[it.id];

            return (
              <div
                key={it.id}
                style={{
                  background: "var(--card-bg, #1f2433)",
                  border: "1px solid var(--card-border, #2a3042)",
                  boxShadow: "0 4px 16px rgba(0,0,0,.12)",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 700 }}>
                      #{it.id} — {formatDate(it.session_time_stamp)}
                    </div>
                    <div style={{ fontSize: 13, color: "#9aa3b2" }}>
                      {t("Peer", "Karşı kullanıcı")}: {peerId}
                    </div>
                  </div>

                  <div
                    className="session-actions"
                    style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                  >
                    <button
                      onClick={() => handleShow(it.id)}
                      style={btn("primary")}
                      title={t("Show transcript", "Transkripti göster")}
                    >
                      {t("Show Transcript", "Transkripti Göster")}
                    </button>

                    <button
                      onClick={() => handleOpenSummary(it.id)}
                      style={btn("ghost")}
                      title={t("View summary page", "Özet sayfasını aç")}
                    >
                      {t("View Summary", "Özeti Gör")}
                    </button>

                    <button
                      onClick={() => handleSummarizeInline(it.id)}
                      style={btn("ghost")}
                      title={t("Summarize inline", "Kartta özet çıkar")}
                      disabled={!!sumLoading[it.id]}
                    >
                      {sumLoading[it.id]
                        ? t("Summarizing...", "Özetleniyor...")
                        : t("Summarize Inline", "Kartta Özetle")}
                    </button>

                    <button
                      onClick={() => handleDownloadSummaryPdf(it.id)}
                      style={btn("outline")}
                      title={t("Download summary PDF", "Özeti PDF indir")}
                    >
                      {t("Download PDF", "PDF İndir")}
                    </button>

                    <button
                      onClick={() => handleDelete(it.id)}
                      style={btn("danger")}
                      title={t("Delete session", "Kaydı sil")}
                    >
                      {t("Delete", "Sil")}
                    </button>
                  </div>
                </div>

                {/* Transcript önizleme */}
                {joined && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      className={`session-preview ${
                        isExpanded ? "scrollable" : ""
                      }`}
                      style={{
                        maxHeight: isExpanded ? 220 : 84,
                      }}
                    >
                      {joined}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() =>
                          setExpanded((m) => ({ ...m, [it.id]: !isExpanded }))
                        }
                        style={btn("ghost")}
                      >
                        {isExpanded
                          ? t("Show Less", "Daha Az Göster")
                          : t("Show More", "Daha Fazla Göster")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Özet varsa kart altında göster */}
                {summaries[it.id] && (
                  <div
                    style={{
                      marginTop: 10,
                      whiteSpace: "pre-wrap",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px dashed #3a425a",
                      borderRadius: 8,
                      padding: 10,
                      color: "#dfe6f3",
                      fontSize: 14.5,
                    }}
                  >
                    {summaries[it.id]}
                  </div>
                )}
              </div>
            );
          })}
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
  if (variant === "danger") {
    return {
      ...base,
      background: "#3a1d1d",
      color: "#ffbdbd",
      border: "1px solid #5a2a2a",
    };
  }

  return {
    ...base,
    background: "#222a3d",
    color: "#e9efff",
    border: "1px solid #2e3752",
  };
}
