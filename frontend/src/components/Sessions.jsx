// src/components/Sessions.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "./LanguageContext";
import api from "../api";

// ---- helpers ----
const TZ = "Europe/Istanbul";

function formatDate(ts, lang = "tr") {
  try {
    return new Date(ts).toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TZ,
    });
  } catch {
    return ts || "";
  }
}

// Köşeli parantezli tag'leri ve gürültü ifadelerini temizle (Türkçe harflere dokunma)
const BRACKET_TAGS = /\[[^\]]+\]/g;
// Eski modellerin yaygın “gürültü” kalıpları (İngilizce):
const NOISE_PHRASES =
  /\b(?:no speech detected|typing sounds?|high[- ]pitched(?: tone| ringing| beep)?|beep|sound of a (?:machine|device)|machine\/device operating)\b/gi;
// Sadece gerçek doldurucular (ASCII), TR harfleri kesinlikle hedef değil:
const FILLERS = /\b(?:uh-?huh|uh|um+|hmm+|mm+|ha+ ?ha+)\b/gi;

function cleanText(s) {
  return (s || "")
    .replace(BRACKET_TAGS, " ")
    .replace(NOISE_PHRASES, " ")
    .replace(FILLERS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function previewFromTranscript(tr, maxLen = 160) {
  const arr = Array.isArray(tr) ? tr : [];
  const text = arr
    .map((x) => (typeof x === "string" ? x : x?.text ?? ""))
    .map(cleanText)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

export default function Sessions({ currentUser }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/sessionlogs");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id) {
    if (
      !window.confirm(
        t("Delete this session?", "Bu kaydı silmek istiyor musun?")
      )
    )
      return;
    try {
      await api.delete(`/sessionlogs/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert(t("Delete failed.", "Silme başarısız."));
    }
  }

  return (
    <>
      <style>{`
        .sessions-wrap { padding: 24px; background: var(--bg-main); }
        .sessions-title { margin: 0 0 16px; color: var(--text-main); font-weight: 800; letter-spacing: .2px; }

        .session-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 18px;
          box-shadow: var(--shadow-card);
          padding: 18px;
          max-width: 920px;
          transition: background .15s, box-shadow .15s, border-color .15s;
        }
        .session-card + .session-card { margin-top: 14px; }
        .session-card:hover { background: var(--nav-bg-hover); border-color: var(--border-card); }

        .card-head {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }
        .meta-line { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pill {
          background: #222a3d; color: #e9efff; border: 1px solid #2e3752;
          padding: 6px 10px; border-radius: 999px; font-weight: 700; font-size: 13px;
          max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .when { color: var(--text-muted); font-weight: 500; }

        .preview-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid #313a54;
          border-radius: 12px;
          padding: 12px;
          color: var(--text-main);
          white-space: pre-wrap;
        }

        .actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
        .btn { border-radius: 10px; padding: 9px 14px; font-weight: 700; font-size: 14px; cursor: pointer; border: 1px solid transparent; }
        .btn-primary { background: linear-gradient(135deg, var(--btn1,#5c93f7), var(--btn2,#4285f4)); color: #fff; box-shadow: 0 1px 8px rgba(66,133,244,.35); }
        .btn-ghost { background: #222a3d; color: #e9efff; border: 1px solid #2e3752; }
        .btn-danger { background: #3a1f27; color: #ffd7d7; border: 1px solid #5c2a36; }
      `}</style>

      <div className="sessions-wrap">
        <h2 className="sessions-title">
          {t("Chat Sessions", "Görüşme Kayıtları")}
        </h2>

        {loading ? (
          <div style={{ color: "var(--text-muted)" }}>
            {t("Loading...", "Yükleniyor...")}
          </div>
        ) : items.length === 0 ? (
          <div style={{ color: "var(--text-muted)" }}>
            {t("No sessions yet.", "Henüz kayıt yok.")}
          </div>
        ) : (
          items.map((it) => {
            const left = it?.user1_name || `#${it?.user1_id}`;
            const right = it?.user2_name || `#${it?.user2_id}`;
            const prev = previewFromTranscript(it?.transcript);

            return (
              <div key={it.id} className="session-card">
                <div className="card-head">
                  <div className="meta-line">
                    <span className="pill">{left}</span>
                    <span className="pill">{right}</span>
                    <span className="when">
                      • {formatDate(it?.session_time_stamp, language)}
                    </span>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(it.id)}
                  >
                    {t("Delete", "Sil")}
                  </button>
                </div>

                {prev && <div className="preview-box">{prev}</div>}

                <div className="actions">
                  <button
                    className="btn btn-ghost"
                    onClick={() => navigate(`/sessions/${it.id}`)}
                  >
                    {t("Show Transcript", "Transkripti Göster")}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/sessions/${it.id}/summary`)}
                  >
                    {t("Show Summary", "Özeti Göster")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
