import React from "react";
import { useLanguage } from "./LanguageContext";
function Main() {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 600, color: "#9aa4b1" }}>
        {t("Will be coded...", "Kodlanacak...")}
      </div>
    </div>
  );
}
export default Main;
