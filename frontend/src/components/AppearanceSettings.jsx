import React from "react";
import { useTheme } from "./ThemeContext";

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  const handleChange = (checked) => {
    const newTheme = checked ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <div>
      <h2
        style={{
          color: "var(--accent-color)",
          marginBottom: 32,
          textAlign: "center",
        }}
      >
        Görünüm
      </h2>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginBottom: 22,
        }}
      >
        <span
          style={{ fontWeight: 600, fontSize: 17, color: "var(--text-main)" }}
        >
          Dark Mode
        </span>
        <Switch checked={theme === "dark"} onChange={handleChange} />
      </div>
      <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
        Tema tercihiniz uygulama açıkken geçerli olur.
      </div>
    </div>
  );
}

// Switch bileşeni
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
