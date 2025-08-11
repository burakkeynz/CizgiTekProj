import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import api from "../api";
import { toast } from "react-toastify";

export default function Register() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isDark = theme === "dark";
  const t = (en, tr) => (language === "tr" ? tr : en);

  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    role: "",
  });

  const [isStrong, setIsStrong] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const pendingTheme = localStorage.getItem("pending_theme");
    if (pendingTheme) setTheme(pendingTheme);
    const pendingLanguage = localStorage.getItem("pending_language");
    if (pendingLanguage) setLanguage(pendingLanguage);
  }, [setTheme, setLanguage]);

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    marginBottom: "15px",
    borderRadius: "6px",
    border: `1px solid ${isDark ? "#23272f" : "var(--accent-color)"}`,
    fontSize: "1rem",
    backgroundColor: isDark ? "#23272f" : "var(--input-bg)",
    color: isDark ? "#ecf1fa" : "var(--text-main)",
    transition: "background-color 0.2s, color 0.2s, border-color 0.2s",
    boxSizing: "border-box",
  };

  const buttonStyle = (disabled) => ({
    width: "100%",
    padding: "12px",
    backgroundColor: disabled
      ? "var(--input-border)"
      : isDark
      ? "#4da5ff"
      : "var(--accent-color)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "1rem",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: "bold",
    transition: "background-color 0.3s, opacity .2s",
    boxSizing: "border-box",
    opacity: submitting ? 0.9 : 1,
  });

  const roleOptions = [
    { value: "Doctor", label: t("Doctor", "Doktor") },
    { value: "Nurse", label: t("Nurse", "Hemşire") },
    { value: "Technician", label: t("Technician", "Teknisyen") },
  ];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const disabled =
    submitting ||
    !form.username ||
    !form.email ||
    !form.first_name ||
    !form.last_name ||
    !form.role ||
    !form.password ||
    !isStrong;

  const handleRegister = async () => {
    if (disabled) return;
    try {
      setSubmitting(true);
      await api.post("/auth/register", form);
      toast.success(
        t(
          "Account created. You can log in now.",
          "Hesap oluşturuldu. Giriş yapabilirsiniz."
        )
      );
      navigate("/login");
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        t("Registration failed!", "Kayıt başarısız!");
      toast.error(String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Segoe UI, Arial, sans-serif",
        padding: "20px",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--card-bg)",
          padding: "40px 48px 36px 48px",
          borderRadius: "8px",
          border: isDark
            ? "1.5px solid #23272f"
            : "1.5px solid var(--accent-color)",
          boxShadow: isDark ? "0 4px 24px #16192555" : "0 4px 16px #83bfff22",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
          color: "var(--text-main)",
          transition: "background 0.2s, border 0.2s, color 0.2s",
        }}
      >
        {/* Theme & Language Switches */}
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Light/Dark */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LightIcon active={theme === "light"} />
            <Switch
              checked={theme === "dark"}
              onChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
            <DarkIcon active={theme === "dark"} />
          </div>
          {/* English/Turkish */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <FlagUSA active={language === "en"} />
            <Switch
              checked={language === "tr"}
              onChange={(checked) => setLanguage(checked ? "tr" : "en")}
            />
            <FlagTR active={language === "tr"} />
          </div>
        </div>

        <div
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            backgroundColor: "var(--accent-color)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="#fff"
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>

        <h2 style={{ marginBottom: "20px", color: "var(--accent-color)" }}>
          {t("Register", "Kayıt Ol")}
        </h2>

        {/* Form Fields */}
        <input
          type="text"
          name="username"
          placeholder={t("Username", "Kullanıcı Adı")}
          value={form.username}
          onChange={handleChange}
          style={inputStyle}
        />
        <input
          type="email"
          name="email"
          placeholder={t("Email", "E-posta")}
          value={form.email}
          onChange={handleChange}
          style={inputStyle}
        />
        <input
          type="text"
          name="first_name"
          placeholder={t("First Name", "Ad")}
          value={form.first_name}
          onChange={handleChange}
          style={inputStyle}
        />
        <input
          type="text"
          name="last_name"
          placeholder={t("Last Name", "Soyad")}
          value={form.last_name}
          onChange={handleChange}
          style={inputStyle}
        />
        <input
          type="password"
          name="password"
          placeholder={t("Password", "Şifre")}
          value={form.password}
          onChange={handleChange}
          style={inputStyle}
          autoComplete="new-password"
        />

        {/* Şifre gücü (boşken gizli, yazınca görünür) */}
        <PasswordStrengthMeter
          value={form.password}
          minimum={2} // en az "Orta"
          onValidChange={setIsStrong}
          compact={false}
          showWhenEmpty={false}
          style={{ marginTop: 6, marginBottom: 10 }}
        />

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          style={inputStyle}
          required
        >
          <option value="" disabled>
            {t("Select role", "Rol Seçin")}
          </option>
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Submit */}
        <button
          onClick={handleRegister}
          disabled={disabled}
          style={buttonStyle(disabled)}
          onMouseOver={(e) => {
            if (!disabled)
              e.currentTarget.style.backgroundColor = "var(--accent-hover)";
          }}
          onMouseOut={(e) => {
            if (!disabled)
              e.currentTarget.style.backgroundColor = isDark
                ? "#4da5ff"
                : "var(--accent-color)";
          }}
        >
          {submitting
            ? t("Creating...", "Oluşturuluyor...")
            : t("Register", "Kayıt Ol")}
        </button>

        <p
          style={{
            marginTop: "20px",
            fontSize: "0.9rem",
            color: "var(--text-muted)",
          }}
        >
          {t("Already have an account?", "Zaten hesabınız var mı?")}{" "}
          <Link to="/login" style={{ color: "#28a745", fontWeight: "bold" }}>
            {t("Login", "Giriş Yap")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <div
      role="switch"
      tabIndex={0}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && onChange(!checked)
      }
      style={{
        width: 50,
        height: 28,
        borderRadius: 18,
        background: checked ? "var(--accent-color)" : "var(--input-border)",
        position: "relative",
        transition: "background 0.2s",
        cursor: "pointer",
        outline: "none",
        boxShadow: checked
          ? "0 2px 8px var(--accent-color)66"
          : "0 2px 8px var(--input-border)66",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--card-bg)",
          position: "absolute",
          left: checked ? 24 : 4,
          transition: "left 0.19s cubic-bezier(.37,.32,.29,.94)",
          boxShadow: "0 1px 4px #0001",
          border: checked
            ? "2px solid var(--accent-color)"
            : "2px solid var(--input-border)",
        }}
      />
    </div>
  );
}

function LightIcon({ active }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      style={{ opacity: active ? 1 : 0.6 }}
    >
      <circle
        cx="12"
        cy="12"
        r="6"
        fill="#FFEB3B"
        stroke="#FFD600"
        strokeWidth="2"
      />
      {[...Array(8)].map((_, i) => (
        <rect
          key={i}
          x="11.5"
          y="1.5"
          width="1"
          height="3"
          rx="0.5"
          fill="#FFD600"
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}

function DarkIcon({ active }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      style={{ opacity: active ? 1 : 0.6 }}
    >
      <path
        d="M16.2 12.01A6.21 6.21 0 0 1 12 18.2c-3.42 0-6.2-2.78-6.2-6.2a6.21 6.21 0 0 1 6.2-6.2c.25 0 .49.02.74.04A5 5 0 0 0 16.2 12.01z"
        fill="#263238"
        stroke="#222"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="8" r="1.3" fill="#333" />
    </svg>
  );
}

function FlagUSA({ active }) {
  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 22 16"
      style={{ opacity: active ? 1 : 0.55 }}
    >
      <rect width="22" height="16" rx="2" fill="#fff" />
      {[...Array(7)].map((_, i) => (
        <rect key={i} y={i * 2} width="22" height="1" fill="#B22234" />
      ))}
      <rect width="8" height="7" fill="#3C3B6E" />
      {[0, 2, 4].map((x, xi) =>
        [1, 3, 5].map((y, yi) => (
          <circle
            key={`${xi}-${yi}`}
            cx={2 + x}
            cy={1 + y}
            r="0.45"
            fill="#fff"
          />
        ))
      )}
    </svg>
  );
}

function FlagTR({ active }) {
  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 22 16"
      style={{ opacity: active ? 1 : 0.55 }}
    >
      <rect width="22" height="16" rx="2" fill="#E30A17" />
      <circle cx="8.5" cy="8" r="4.5" fill="#fff" />
      <circle cx="10" cy="8" r="3.5" fill="#E30A17" />
      <polygon
        points="13.7,8 12.78,8.66 13.13,7.59 12.21,6.91 13.35,6.91 13.7,5.85 14.05,6.91 15.19,6.91 14.27,7.59 14.62,8.66"
        fill="#fff"
        transform="scale(1.15) translate(-1.7,-1.1)"
      />
    </svg>
  );
}
