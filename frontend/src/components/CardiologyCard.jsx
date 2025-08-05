import React from "react";
import ekgexp from "../assets/ekgexp.png";
import efortesti from "../assets/efortesti.jpg";
import { useLanguage } from "./LanguageContext";

export default function CardiologyCards({ selectedId, setSelectedId }) {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const cardiologyData = [
    {
      id: 1,
      title: t("ECG", "EKG"),
      summary: t("Electrocardiogram test.", "Elektrokardiyografi testi."),
      image: ekgexp,
    },
    {
      id: 2,
      title: t("Stress Test", "Efor Testi"),
      summary: t("Description of the stress test.", "Efor testi açıklaması."),
      image: efortesti,
    },
  ];

  return (
    <section style={{ marginTop: 40, display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontWeight: 600,
            fontSize: 22,
            marginBottom: 18,
            color: "var(--accent-hover)",
          }}
        >
          {t("Cardiology Summaries", "Kardiyoloji Özetleri")}
        </h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {cardiologyData.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(isSelected ? null : item.id)}
                style={{
                  cursor: "pointer",
                  padding: 16,
                  width: isSelected ? 320 : 180,
                  borderRadius: 12,
                  background: isSelected
                    ? "var(--accent-hover)"
                    : "var(--bg-muted)",
                  color: isSelected ? "white" : "var(--text-main)",
                  boxShadow: isSelected
                    ? "0 10px 30px rgba(0,0,0,0.3)"
                    : "var(--shadow-strong)",
                  transition: "all 0.3s ease",
                  fontWeight: 600,
                  fontSize: isSelected ? 18 : 15,
                  lineHeight: 1.4,
                  position: "relative",
                  zIndex: isSelected ? 10 : 1,
                  overflow: "hidden",
                }}
                title={`${item.title}`}
              >
                <div>{item.title}</div>
                <div
                  style={{
                    marginTop: 10,
                    fontWeight: 400,
                    fontSize: 14,
                    maxHeight: isSelected ? 120 : 60,
                    overflowY: "auto",
                  }}
                >
                  {item.summary}
                </div>

                {isSelected && (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 8,
                      overflow: "hidden",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      style={{ width: "100%", display: "block" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside
        style={{
          width: 200,
          padding: 16,
          background: "var(--card-bg)",
          borderRadius: 12,
          boxShadow: "var(--shadow-card)",
          color: "var(--text-main)",
        }}
      >
        <h4>{t("Remaining Tests", "Kalan Testler")}</h4>
        {cardiologyData
          .filter((item) => item.id !== selectedId)
          .map((item) => (
            <div
              key={item.id}
              style={{
                padding: 8,
                borderBottom: "1px solid var(--border-card)",
                cursor: "pointer",
              }}
              onClick={() => setSelectedId(item.id)}
            >
              {item.title}
            </div>
          ))}
      </aside>
    </section>
  );
}
