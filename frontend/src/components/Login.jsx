import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";
import api from "../api";

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
        background: checked ? "#37c971" : "#cfd6e1",
        position: "relative",
        transition: "background 0.2s",
        cursor: "pointer",
        outline: "none",
        boxShadow: checked ? "0 2px 8px #37c97133" : "0 2px 8px #cfd6e133",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          left: checked ? 24 : 4,
          transition: "left 0.19s cubic-bezier(.37,.32,.29,.94)",
          boxShadow: "0 1px 4px #0001",
          border: checked ? "2px solid #37c971" : "2px solid #e4e8ee",
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
          <circle key={xi + yi} cx={2 + x} cy={1 + y} r="0.45" fill="#fff" />
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

function Login() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isDark = theme === "dark";
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const pendingTheme = localStorage.getItem("pending_theme");
    if (pendingTheme) setTheme(pendingTheme);
    const pendingLang = localStorage.getItem("pending_language");
    if (pendingLang) setLanguage(pendingLang);
  }, [setTheme, setLanguage]);

  const handleLogin = async () => {
    setError("");
    const data = new URLSearchParams();
    data.append("username", username);
    data.append("password", password);

    try {
      await api.post("/auth/token", data);

      const pendingTheme = localStorage.getItem("pending_theme");
      if (pendingTheme) {
        setTheme(pendingTheme);
        localStorage.setItem("theme", pendingTheme);
        localStorage.removeItem("pending_theme");
      }

      const pendingLang = localStorage.getItem("pending_language");
      if (pendingLang) {
        setLanguage(pendingLang);
        localStorage.setItem("language", pendingLang);
        localStorage.removeItem("pending_language");
      }

      window.location.reload();
    } catch {
      setError(
        language === "tr"
          ? "Giriş başarısız, bilgilerinizi kontrol edin"
          : "Login failed, check your credentials"
      );
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDark
          ? "linear-gradient(135deg, #23272f, #15181c 80%)"
          : "linear-gradient(135deg, #ffffff, #f0f2f5 80%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Segoe UI, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          position: "relative",
          background: isDark ? "#1c1f23" : "#fff",
          padding: "48px 48px 36px 48px",
          borderRadius: "11px",
          border: isDark ? "1.5px solid #23272f" : "1.5px solid #007BFF",
          boxShadow: isDark ? "0 4px 32px #16192555" : "0 4px 20px #83bfff22",
          width: "100%",
          maxWidth: 475,
          minWidth: 375,
          textAlign: "center",
          color: isDark ? "#ecf1fa" : "#23272f",
          transition: "background 0.2s, border 0.2s, color 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 24,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LightIcon active={theme === "light"} />
            <Switch
              checked={theme === "dark"}
              onChange={(checked) => {
                const newTheme = checked ? "dark" : "light";
                localStorage.setItem("pending_theme", newTheme);
                setTheme(newTheme);
              }}
            />
            <DarkIcon active={theme === "dark"} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <FlagUSA active={language === "en"} />
            <Switch
              checked={language === "tr"}
              onChange={(checked) => {
                const newLang = checked ? "tr" : "en";
                localStorage.setItem("pending_language", newLang);
                setLanguage(newLang);
              }}
            />
            <FlagTR active={language === "tr"} />
          </div>
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 18,
            color: isDark ? "#4da5ff" : "#2d6be7",
          }}
        >
          {language === "tr" ? "Giriş Yap" : "Login"}
        </div>

        <input
          type="text"
          placeholder={language === "tr" ? "Kullanıcı Adı" : "Username"}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "13px 16px",
            marginBottom: 13,
            borderRadius: "7px",
            border: isDark ? "1.3px solid #384969" : "1.3px solid #007BFF",
            fontSize: "1rem",
            background: isDark ? "#23272f" : "#fff",
            color: isDark ? "#ecf1fa" : "#23272f",
            fontWeight: 500,
            outline: "none",
          }}
          autoFocus
        />
        <input
          type="password"
          placeholder={language === "tr" ? "Şifre" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "13px 16px",
            marginBottom: 13,
            borderRadius: "7px",
            border: isDark ? "1.3px solid #384969" : "1.3px solid #007BFF",
            fontSize: "1rem",
            background: isDark ? "#23272f" : "#fff",
            color: isDark ? "#ecf1fa" : "#23272f",
            fontWeight: 500,
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />
        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "12px",
            background: isDark ? "#4da5ff" : "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: "bold",
            marginBottom: 10,
            cursor: "pointer",
          }}
        >
          {language === "tr" ? "Giriş Yap" : "Login"}
        </button>

        {error && (
          <div
            style={{
              color: "#e53749",
              fontWeight: 600,
              fontSize: 15,
              marginBottom: 10,
            }}
          >
            {error}
          </div>
        )}

        <p
          style={{
            marginTop: "12px",
            fontSize: "0.96rem",
            color: isDark ? "#b6c4d2" : "#666",
          }}
        >
          {language === "tr"
            ? "Hesabınız yok mu? "
            : "Don't you have an account? "}
          <Link to="/register" style={{ color: "#dc3545", fontWeight: "bold" }}>
            {language === "tr" ? "Kayıt Ol" : "Register"}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
