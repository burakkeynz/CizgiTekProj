import React, { useState } from "react";
import api from "../api";
import { useLanguage } from "./LanguageContext";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

export default function PasswordSettings() {
  const { language } = useLanguage();
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [message, setMessage] = useState("");
  const [strongEnough, setStrongEnough] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = (en, tr) => (language === "tr" ? tr : en);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!passwords.current)
      return setMessage(
        t("Current password is required.", "Mevcut şifre gerekli.")
      );
    if (passwords.new !== passwords.confirm)
      return setMessage(t("Passwords must match!", "Şifreler aynı olmalı!"));
    if (!strongEnough)
      return setMessage(
        t(
          "Please choose a stronger password.",
          "Lütfen daha güçlü bir şifre seçin."
        )
      );
    try {
      setSubmitting(true);
      await api.put("/users/change_password", {
        password: passwords.current,
        new_password: passwords.new,
      });
      setMessage(
        t("Password successfully changed!", "Şifre başarıyla değişti!")
      );
      setPasswords({ current: "", new: "", confirm: "" });
      setStrongEnough(false);
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        t("Failed to update password.", "Şifre değiştirilemedi.");
      setMessage(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const LABELS = {
    title: t("Change Password", "Şifre Değiştir"),
    current: t("Current Password", "Mevcut Şifre"),
    new: t("New Password", "Yeni Şifre"),
    confirm: t("Confirm Password", "Yeni Şifre (Tekrar)"),
    button: t("Update Password", "Şifreyi Güncelle"),
    match_ok: t("Passwords match", "Şifreler eşleşiyor"),
    match_bad: t("Passwords do not match", "Şifreler eşleşmiyor"),
  };

  const confirmTouched = passwords.confirm.length > 0;
  const matches = passwords.new === passwords.confirm;
  const disabled =
    submitting ||
    !passwords.current ||
    !passwords.new ||
    !strongEnough ||
    !matches;

  return (
    <form onSubmit={handlePasswordUpdate}>
      <h2
        style={{
          color: "var(--accent-color)",
          marginBottom: 22,
          textAlign: "center",
          fontWeight: 700,
          letterSpacing: ".4px",
        }}
      >
        {LABELS.title}
      </h2>

      <input
        type="password"
        placeholder={LABELS.current}
        value={passwords.current}
        onChange={(e) => {
          setPasswords({ ...passwords, current: e.target.value });
          setMessage("");
        }}
        style={inputStyle}
        autoComplete="current-password"
      />

      <input
        type="password"
        placeholder={LABELS.new}
        value={passwords.new}
        onChange={(e) => {
          setPasswords({ ...passwords, new: e.target.value });
          setMessage("");
        }}
        style={inputStyle}
        autoComplete="new-password"
      />

      <input
        type="password"
        placeholder={LABELS.confirm}
        value={passwords.confirm}
        onChange={(e) => {
          setPasswords({ ...passwords, confirm: e.target.value });
          setMessage("");
        }}
        style={inputStyle}
        autoComplete="new-password"
      />

      {/* Eşleşme durumu */}
      {confirmTouched && (
        <div
          style={{
            marginTop: -6,
            marginBottom: 8,
            fontSize: 13,
            fontWeight: 600,
            color: matches ? "#24b47e" : "#ea2e49",
          }}
        >
          {matches ? LABELS.match_ok : LABELS.match_bad}
        </div>
      )}

      <PasswordStrengthMeter
        value={passwords.new}
        minimum={2}
        onValidChange={setStrongEnough}
        compact={false}
        showWhenEmpty={false}
        style={{ marginTop: 12, marginBottom: 8 }}
      />

      <button
        type="submit"
        disabled={disabled}
        style={{
          width: "100%",
          background: disabled ? "var(--input-border)" : "var(--accent-color)",
          color: "#fff",
          fontWeight: "bold",
          border: "none",
          borderRadius: 8,
          padding: 13,
          marginTop: 10,
          fontSize: 15,
          transition: "background .17s, opacity .17s",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: submitting ? 0.85 : 1,
        }}
      >
        {submitting ? t("Updating...", "Güncelleniyor...") : LABELS.button}
      </button>

      {message && (
        <div
          style={{
            marginTop: 14,
            color:
              message.toLowerCase().includes("success") ||
              message.includes("başarı")
                ? "var(--accent-color)"
                : "#ea2e49",
            textAlign: "center",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          {message}
        </div>
      )}
    </form>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "1.5px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-main)",
  fontSize: 16,
  marginBottom: 13,
  outline: "none",
  transition: "background .18s, color .18s",
};
