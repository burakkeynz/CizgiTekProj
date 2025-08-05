import React, { useEffect, useState } from "react";
import api from "../api";
import { useLanguage } from "./LanguageContext";

export default function ProfileSettings() {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const [user, setUser] = useState(null);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  if (!user) {
    return (
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 16,
          textAlign: "center",
          padding: "40px 0",
        }}
      >
        {t("Loading user information...", "Kullanıcı bilgileri yükleniyor...")}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        background: "var(--bg-main)",
        borderRadius: 16,
        boxShadow: "0 4px 12px #0001",
        maxWidth: 480,
        marginTop: 40,
        marginLeft: "min(40px, 5vw)",
      }}
    >
      <h2
        style={{
          color: "var(--accent-color)",
          marginBottom: 22,
          textAlign: "center",
          fontWeight: 700,
          letterSpacing: ".4px",
        }}
      >
        {t("Profile Information", "Profil Bilgileri")}
      </h2>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>{t("Username", "Kullanıcı Adı")}</label>
        <input value={user.username || ""} disabled style={inputStyle} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>{t("Full Name", "Ad Soyad")}</label>
        <input
          value={(user.first_name || "") + " " + (user.last_name || "")}
          disabled
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>{t("Role", "Rol")}</label>
        <input value={user.role || ""} disabled style={inputStyle} />
      </div>

      {user.role === "doctor" && (
        <div
          style={{
            color: "var(--accent-color)",
            marginTop: 18,
            fontWeight: 500,
          }}
        >
          {t("Extra setting for doctors:", "Doktorlar için ekstra ayar:")}{" "}
          <b>{t("Polyclinic Selection", "Poliklinik Seçimi")}</b>
        </div>
      )}

      {user.role === "technician" && (
        <div style={{ color: "#17a2b8", marginTop: 18, fontWeight: 500 }}>
          {t(
            "Extra setting for technicians:",
            "Teknisyenler için ekstra ayar:"
          )}{" "}
          <b>{t("Department Selection", "Departman Seçimi")}</b>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  fontWeight: 600,
  color: "var(--text-main)",
  fontSize: 15,
  marginBottom: 3,
  display: "block",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "1.5px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-main)",
  fontSize: 16,
  marginTop: 3,
  outline: "none",
  transition: "background 0.18s, color 0.18s",
};
