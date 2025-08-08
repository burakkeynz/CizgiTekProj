import React from "react";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  const handleThemeChange = (checked) => setTheme(checked ? "dark" : "light");
  const handleLanguageChange = (checked) => setLanguage(checked ? "tr" : "en");

  return (
    <div>
      <h2
        style={{
          color: "var(--accent-color)",
          marginBottom: 32,
          textAlign: "center",
        }}
      >
        {language === "tr" ? "Görünüm" : "Appearance"}
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            minWidth: 60,
            justifyContent: "flex-end",
          }}
        >
          <LightIcon active={theme === "light"} />
          <span
            style={{
              fontWeight: theme === "light" ? 700 : 400,
              fontSize: 15,
              color: "var(--text-main)",
              opacity: theme === "light" ? 1 : 0.6,
              transition: "opacity 0.12s",
            }}
          >
            {language === "tr" ? "Açık" : "Light"}
          </span>
        </div>
        <Switch checked={theme === "dark"} onChange={handleThemeChange} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            minWidth: 60,
            justifyContent: "flex-start",
          }}
        >
          <DarkIcon active={theme === "dark"} />
          <span
            style={{
              fontWeight: theme === "dark" ? 700 : 400,
              fontSize: 15,
              color: "var(--text-main)",
              opacity: theme === "dark" ? 1 : 0.6,
              transition: "opacity 0.12s",
            }}
          >
            {language === "tr" ? "Koyu" : "Dark"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginBottom: 22,
        }}
      >
        <FlagUSA active={language === "en"} />
        <span
          style={{ fontWeight: 600, fontSize: 17, color: "var(--text-main)" }}
        >
          {language === "tr" ? "Dil" : "Language"}
        </span>
        <Switch checked={language === "tr"} onChange={handleLanguageChange} />
        <FlagTR active={language === "tr"} />
      </div>
      <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
        {language === "tr"
          ? "Varsayılan olarak uygulama açık temayı ve İngilizce dilini kullanır."
          : "By default, app uses light theme and English language."}
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
