import React from "react";
import { useTheme } from "./ThemeContext";

function Goodbye() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
            color: isDark ? "#4da5ff" : "#22c55e",
            marginBottom: 14,
            transition: "color 0.2s",
          }}
        >
          👋
        </span>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          GoodBye!
        </div>
        <div style={{ marginBottom: 20 }}>Başarıyla çıkış yaptınız.</div>
        <a
          href="/login"
          style={{
            background: "#0066ff",
            color: "#fff",
            padding: "9px 28px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            transition: "background 0.17s",
            boxShadow: isDark ? "0 2px 8px #0066ff55" : "0 2px 8px #bfdcff33",
          }}
        >
          Login
        </a>
      </div>
    </div>
  );
}

export default Goodbye;
