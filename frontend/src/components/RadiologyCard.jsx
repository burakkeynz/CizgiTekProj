import React from "react";
import { useLanguage } from "./LanguageContext";

export default function RadiologyCards({ selectedId, setSelectedId, data }) {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  return (
    <section style={{ marginTop: 40 }}>
      <h3
        style={{
          fontWeight: 600,
          fontSize: 22,
          marginBottom: 18,
          color: "var(--accent-hover)",
        }}
      >
        {t("Radiology Results", "Radyoloji Sonuçları")}
      </h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {data.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedId(isSelected ? null : item.id)}
              style={{
                cursor: "pointer",
                padding: 12,
                width: isSelected ? 300 : 140,
                height: isSelected ? 180 : 90,
                borderRadius: 12,
                background: isSelected
                  ? "var(--accent-hover)"
                  : "var(--bg-muted)",
                color: isSelected ? "white" : "var(--text-main)",
                boxShadow: "var(--shadow-strong)",
                transition: "all 0.3s ease",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                fontWeight: 600,
                fontSize: isSelected ? 18 : 14,
              }}
              title={`${item.type} - ${item.date}`}
            >
              <div>{item.type}</div>
              <div style={{ marginTop: 8, fontWeight: 400, fontSize: 12 }}>
                {item.description}
              </div>
              {isSelected && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    background: "rgba(255 255 255 / 0.3)",
                    borderRadius: 8,
                    fontWeight: 400,
                    fontSize: 14,
                    maxHeight: 70,
                    overflowY: "auto",
                    textAlign: "center",
                  }}
                >
                  {t(
                    "Detailed image or explanation can be shown here.",
                    "Burada detaylı görüntü veya açıklama olabilir."
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
