import { useEffect } from "react";
import { useTheme } from "./ThemeContext";
import api from "../api";

function SessionExpired() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const lastTheme = localStorage.getItem("last_theme") || "light";
    setTheme(lastTheme);
    api.post("/auth/logout").catch(() => {});
  }, [setTheme]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isDark
          ? "linear-gradient(135deg, #1a1d22, #23272f 80%)"
          : "#f8fafc",
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          background: isDark ? "#181c23" : "#fff",
          border: isDark ? "1.5px solid #23272f" : "1px solid #e5e7eb",
          padding: "48px 40px",
          borderRadius: 16,
          boxShadow: isDark ? "0 4px 32px #10141d65" : "0 4px 32px #dbeafe45",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: isDark ? "#ecf1fa" : "#23272f",
          transition: "background 0.2s, border 0.2s, color 0.2s",
        }}
      >
        <span
          style={{
            fontSize: 54,
            color: isDark ? "#4da5ff" : "#0066ff",
            marginBottom: 14,
          }}
        >
          😕
        </span>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 14 }}>
          Oturumunuz sona erdi
        </div>
        <div style={{ marginBottom: 20 }}>Lütfen tekrar giriş yapın.</div>
        <a
          href="/login"
          onClick={() => localStorage.removeItem("last_theme")}
          style={{
            background: "#0066ff",
            color: "#fff",
            padding: "9px 28px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            boxShadow: isDark ? "0 2px 8px #0066ff55" : "0 2px 8px #bfdcff33",
            transition: "box-shadow 0.2s",
          }}
        >
          Login
        </a>
      </div>
    </div>
  );
}

export default SessionExpired;
