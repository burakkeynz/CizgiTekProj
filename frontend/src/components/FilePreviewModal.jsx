import React, { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const SUPPORTED_IMAGES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export default function FilePreviewModal({
  fileType,
  fileKey, // Artık S3 "key" alınacak!
  fileName,
  onClose,
}) {
  const [fileUrl, setFileUrl] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Presigned url çek
  useEffect(() => {
    if (!fileKey) return;
    setLoading(true);
    setFetchError(null);
    setFileUrl(null);
    setExcelData(null);

    fetch(`/files/presign?key=${encodeURIComponent(fileKey)}`, {
      credentials: "include", // cookie bazlı auth
    })
      .then((res) => {
        if (!res.ok) throw new Error("Dosya linki alınamadı");
        return res.json();
      })
      .then((data) => {
        setFileUrl(data.url);
      })
      .catch((err) => {
        setFetchError("Dosya önizlemede hata: " + err.message);
      })
      .finally(() => setLoading(false));
  }, [fileKey]);

  // Excel/csv için okuma (fileUrl değiştikçe)
  useEffect(() => {
    if (
      fileUrl &&
      (fileType?.includes("spreadsheet") ||
        fileName?.endsWith(".xlsx") ||
        fileName?.endsWith(".xls") ||
        fileName?.endsWith(".csv"))
    ) {
      setLoading(true);
      fetch(fileUrl)
        .then((res) => res.arrayBuffer())
        .then((ab) => {
          const workbook = XLSX.read(ab, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          setExcelData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [fileUrl, fileType, fileName]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(30,35,50,0.66)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          minWidth: 340,
          minHeight: 120,
          maxWidth: 640,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 6px 32px #0005",
          padding: 24,
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 18,
            fontSize: 22,
            cursor: "pointer",
            opacity: 0.6,
          }}
        >
          ✖
        </span>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
          {fileName}
        </div>

        {fetchError && (
          <div style={{ color: "#a00", marginTop: 14 }}>{fetchError}</div>
        )}

        {loading && (
          <div style={{ color: "#888", margin: "18px 0" }}>Yükleniyor...</div>
        )}

        {!loading && fileUrl && (
          <>
            {/* --- PDF --- */}
            {fileType === "application/pdf" && (
              <Document file={fileUrl}>
                <Page pageNumber={1} width={540} />
              </Document>
            )}

            {/* --- IMAGE --- */}
            {SUPPORTED_IMAGES.includes(fileType) && (
              <img
                src={fileUrl}
                alt="Preview"
                style={{
                  maxWidth: 540,
                  borderRadius: 10,
                  boxShadow: "0 1px 6px #0002",
                }}
              />
            )}

            {/* --- EXCEL/CSV --- */}
            {(fileType?.includes("spreadsheet") ||
              fileName?.endsWith(".xlsx") ||
              fileName?.endsWith(".xls") ||
              fileName?.endsWith(".csv")) && (
              <div>
                {loading ? (
                  <span>Yükleniyor...</span>
                ) : (
                  <table style={{ fontSize: 13, borderCollapse: "collapse" }}>
                    <tbody>
                      {excelData?.slice(0, 30).map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              style={{
                                border: "1px solid #ccc",
                                padding: 3,
                                background: i === 0 ? "#f6f6f6" : "#fff",
                              }}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* --- TXT --- */}
            {fileType === "text/plain" && (
              <iframe
                src={fileUrl}
                title="txt"
                style={{
                  width: 540,
                  height: 380,
                  border: "none",
                  borderRadius: 10,
                }}
              />
            )}

            {/* --- DESTEKLENMEYEN --- */}
            {!fileType?.startsWith("image/") &&
              fileType !== "application/pdf" &&
              !fileType?.includes("spreadsheet") &&
              fileType !== "text/plain" &&
              !fileName?.endsWith(".csv") && (
                <div style={{ color: "#a00", marginTop: 12 }}>
                  Bu dosya tipi için önizleme desteklenmiyor.
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
