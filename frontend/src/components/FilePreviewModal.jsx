import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "./LanguageContext";
import { useTheme } from "./ThemeContext";
import * as XLSX from "xlsx";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf";

// Workerı paketten (local) CORS sorunlarını önler
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.js",
  import.meta.url
).toString();

const SUPPORTED_IMAGES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

function PdfPageCanvas({ doc, pageNumber, width = 540, borderColor }) {
  const canvasRef = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let renderTask = null;

    (async () => {
      try {
        const p = await doc.getPage(pageNumber);
        if (cancelled) return;

        const scale = width / p.view[2]; // sayfa genişliğine göre ölçek
        const viewport = p.getViewport({ scale });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { alpha: false });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        renderTask = p.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e) {
        if (!cancelled) setErr(e?.message || "PDF render failed");
      }
    })();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {}
    };
  }, [doc, pageNumber, width]);

  return (
    <div
      style={{
        display: "inline-block",
        padding: 8,
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: "var(--card-bg)",
      }}
    >
      {err ? (
        <div style={{ padding: 10, maxWidth: width }}>PDF yüklenemedi.</div>
      ) : (
        <canvas
          ref={canvasRef}
          style={{ display: "block", maxWidth: "100%" }}
        />
      )}
    </div>
  );
}

function PdfPreview({ url, width = 540, borderColor, textColor }) {
  const [doc, setDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setErr(null);
    setDoc(null);

    const loadingTask = pdfjs.getDocument({
      url,
      withCredentials: true, // backend stream endpointi için
    });

    loadingTask.promise
      .then((d) => {
        setDoc(d);
        setNumPages(d.numPages || 1);
      })
      .catch((e) => setErr(e?.message || "PDF yüklenemedi"))
      .finally(() => setLoading(false));

    return () => {
      try {
        loadingTask?.destroy?.();
      } catch {}
    };
  }, [url]);

  if (loading) return <div style={{ color: textColor }}>Yükleniyor…</div>;
  if (err) return <div style={{ color: "#d9534f" }}>{err}</div>;
  if (!doc) return null;

  return (
    <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 8 }}>
      {[...Array(numPages)].map((_, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              marginBottom: 6,
              color: textColor,
            }}
          >
            Sayfa {i + 1} / {numPages}
          </div>
          <PdfPageCanvas
            doc={doc}
            pageNumber={i + 1}
            width={width}
            borderColor={borderColor}
          />
        </div>
      ))}
    </div>
  );
}

export default function FilePreviewModal({
  fileType,
  fileKey,
  fileName,
  onClose,
}) {
  const [fileUrl, setFileUrl] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark =
    theme === "dark" || document.body.getAttribute("data-theme") === "dark";
  const t = (en, tr) => (language === "tr" ? tr : en);

  const isSpreadsheetLike =
    (fileType && fileType.includes("spreadsheet")) ||
    (fileName || "").toLowerCase().endsWith(".xlsx") ||
    (fileName || "").toLowerCase().endsWith(".xls") ||
    (fileName || "").toLowerCase().endsWith(".csv") ||
    fileType === "text/csv";

  const COLORS = {
    overlay: isDark ? "rgba(0,0,0,0.6)" : "rgba(30,35,50,0.66)",
    cardBg: "var(--card-bg)",
    text: "var(--text-main)",
    border: "var(--input-border)",
    accent: "var(--accent-color)",
    muted: isDark ? "#b8c1d0" : "#7a869a",
    tableBorder: isDark ? "#3a4254" : "#eee",
    tableCellBorder: isDark ? "#424b60" : "#ddd",
    tableHeaderBg: isDark ? "#2b3242" : "#f6f6f6",
    danger: "#d9534f",
    boxShadow: "0 6px 32px var(--shadow-card)",
    btnBg: "var(--input-bg)",
    btnBorder: "var(--input-border)",
  };

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  // Backend stream URL
  useEffect(() => {
    if (!fileKey) return;
    setLoading(true);
    setFetchError(null);
    setFileUrl(null);
    setExcelData(null);

    const base = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
    setFileUrl(`${base}/files/stream?key=${encodeURIComponent(fileKey)}`);
    setLoading(false);
  }, [fileKey]);

  // Excel/CSV oku (cookie gönder)
  useEffect(() => {
    if (!fileUrl || !isSpreadsheetLike) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(fileUrl, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        if (cancelled) return;
        const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
        const first = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(first, { header: 1 });
        setExcelData(data);
      } catch (e) {
        console.warn("Spreadsheet preview failed:", e);
        setExcelData([]);
        setFetchError(
          (prev) =>
            prev ||
            (language === "tr"
              ? "Tablo önizleme açılamadı. Dosyayı indirip açabilirsiniz."
              : "Could not render table preview. You can download and open it.")
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, isSpreadsheetLike, language]);

  function getSafeFileName() {
    if (fileName && fileName.trim()) return fileName;
    if (fileKey) {
      const parts = String(fileKey).split("/");
      return parts[parts.length - 1] || "download";
    }
    try {
      const u = new URL(fileUrl);
      const last = (u.pathname.split("/").pop() || "").split("?")[0];
      return last || "download";
    } catch {
      return "download";
    }
  }

  async function handleDownload() {
    if (!fileKey) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const base = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
      const name = encodeURIComponent(getSafeFileName());
      window.location.assign(
        `${base}/files/stream?key=${encodeURIComponent(
          fileKey
        )}&dl=true&name=${name}`
      );
    } catch {
      setDownloadError(
        t(
          "Download link could not be created.",
          "İndirme linki oluşturulamadı."
        )
      );
    } finally {
      setDownloading(false);
    }
  }

  const iconBtnBase = {
    background: COLORS.btnBg,
    border: `1px solid ${COLORS.btnBorder}`,
    color: COLORS.text,
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    lineHeight: 1,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.overlay,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.cardBg,
          color: COLORS.text,
          borderRadius: 16,
          minWidth: 340,
          minHeight: 120,
          maxWidth: 680,
          width: "min(92vw, 680px)",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: COLORS.boxShadow,
          padding: 24,
          position: "relative",
          border: `1px solid ${COLORS.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* indirme ve kapatma */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={handleDownload}
            title={t("Download", "İndir")}
            aria-label={t("Download", "İndir")}
            disabled={downloading}
            style={{ ...iconBtnBase, opacity: downloading ? 0.7 : 1 }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          <button
            onClick={onClose}
            title={t("Close", "Kapat")}
            aria-label={t("Close", "Kapat")}
            style={iconBtnBase}
          >
            <span style={{ fontSize: 18, transform: "translateY(-1px)" }}>
              ×
            </span>
          </button>
        </div>

        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            marginBottom: 12,
            paddingRight: 84,
            wordBreak: "break-word",
          }}
        >
          {fileName}
        </div>

        {downloadError && (
          <div style={{ color: COLORS.danger, marginBottom: 8 }}>
            {downloadError}
          </div>
        )}

        {fetchError && (
          <div style={{ color: COLORS.danger, marginTop: 8 }}>{fetchError}</div>
        )}

        {loading && (
          <div style={{ color: COLORS.muted, margin: "18px 0" }}>
            {t("Loading...", "Yükleniyor...")}
          </div>
        )}

        {!loading && fileUrl && (
          <>
            {/* PDFte birden fazla çok sayfa gösterme */}
            {fileType === "application/pdf" && (
              <PdfPreview
                url={fileUrl}
                width={540}
                borderColor={COLORS.border}
                textColor={COLORS.muted}
              />
            )}

            {/* imageler */}
            {SUPPORTED_IMAGES.includes(fileType) && (
              <img
                src={fileUrl}
                crossOrigin="use-credentials"
                alt="Preview"
                style={{
                  maxWidth: 540,
                  borderRadius: 10,
                  boxShadow: "0 1px 6px #0002",
                  border: `1px solid ${COLORS.border}`,
                }}
              />
            )}

            {/* Audio ve Video */}
            {fileType?.startsWith("audio/") && (
              <audio
                controls
                src={fileUrl}
                crossOrigin="use-credentials"
                style={{ maxWidth: 540, display: "block", marginTop: 6 }}
              />
            )}
            {fileType?.startsWith("video/") && (
              <video
                controls
                src={fileUrl}
                crossOrigin="use-credentials"
                style={{
                  maxWidth: 540,
                  borderRadius: 8,
                  display: "block",
                  marginTop: 6,
                  border: `1px solid ${COLORS.border}`,
                }}
              />
            )}

            {/* Excel ve CSV */}
            {isSpreadsheetLike && (
              <div style={{ marginTop: 12 }}>
                {!excelData || excelData.length === 0 ? (
                  <span style={{ color: COLORS.muted }}>
                    {t("Loading table...", "Tablo yükleniyor...")}
                  </span>
                ) : (
                  <div
                    style={{
                      maxWidth: 540,
                      overflowX: "auto",
                      border: `1px solid ${COLORS.tableBorder}`,
                      borderRadius: 8,
                    }}
                  >
                    <table
                      style={{
                        fontSize: 13,
                        borderCollapse: "collapse",
                        width: "100%",
                      }}
                    >
                      <tbody>
                        {excelData.slice(0, 30).map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                style={{
                                  border: `1px solid ${COLORS.tableCellBorder}`,
                                  padding: "6px 8px",
                                  background:
                                    i === 0
                                      ? COLORS.tableHeaderBg
                                      : "transparent",
                                  whiteSpace: "nowrap",
                                  color: COLORS.text,
                                }}
                              >
                                {String(cell ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {fileType === "text/plain" && (
              <iframe
                src={fileUrl}
                title="txt"
                style={{
                  width: 540,
                  height: 380,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  background: isDark ? "#11161f" : "#fff",
                }}
              />
            )}

            {!fileType?.startsWith("image/") &&
              fileType !== "application/pdf" &&
              !isSpreadsheetLike &&
              fileType !== "text/plain" &&
              !fileType?.startsWith("audio/") &&
              !fileType?.startsWith("video/") && (
                <div style={{ color: COLORS.danger, marginTop: 12 }}>
                  {t(
                    "Preview not supported for this file type.",
                    "Bu dosya tipi için önizleme desteklenmiyor."
                  )}
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
