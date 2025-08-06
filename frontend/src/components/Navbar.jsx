import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiVideo,
  FiMessageCircle,
  FiSettings,
  FiLogOut,
  FiFileText,
} from "react-icons/fi";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";
import api from "../api";

export default function Navbar({ user, conversations }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);
  const unreadChatsCount = conversations.filter(
    (c) => c.unread_count > 0
  ).length;

  const NAV_ITEMS = [
    {
      label: t("Home", "Ana Sayfa"),
      to: "/dashboard",
      icon: <FiHome size={26} />,
    },
    {
      label: t("Patients", "Hastalar"),
      to: "/patients",
      icon: <FiUsers size={26} />,
    },
    {
      label: t("Sessions", "Oturumlar"),
      to: "/sessions",
      icon: <FiVideo size={26} />,
    },
    {
      label: t("Chats", "Sohbetler"),
      to: "/chat",
      icon: <FiMessageCircle size={26} />,
    },
    {
      label: t("Logs", "Kayıtlar"),
      to: "/logs",
      icon: <FiFileText size={26} />,
    },
    {
      label: t("Settings", "Ayarlar"),
      to: "/settings",
      icon: <FiSettings size={26} />,
    },
  ];

  const handleLogout = async () => {
    try {
      if (window.socket && user && user.id) {
        window.socket.emit("user_status", {
          user_id: user.id,
          status: "offline",
        });
      }
      localStorage.setItem("pending_theme", theme);
      localStorage.setItem("pending_language", language);
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout failed, proceeding anyway.");
    } finally {
      window.location.href = "/goodbye";
    }
  };

  return (
    <div
      style={{
        width: 200,
        background: "var(--nav-bg)",
        color: "var(--text-main)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 36,
        minHeight: "100vh",
        justifyContent: "space-between",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <div style={{ width: "100%" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          const showBadge = item.to === "/chat" && unreadChatsCount > 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 15,
                padding: "14px 30px",
                color: isActive ? "var(--accent-color)" : "var(--text-main)",
                background: isActive ? "var(--nav-bg-active)" : "var(--nav-bg)",
                fontWeight: isActive ? "bold" : 400,
                textDecoration: "none",
                fontSize: 16,
                borderRadius: 12,
                marginBottom: 8,
                transition: "all 0.17s",
                position: "relative", // Badge için
              }}
            >
              {React.cloneElement(item.icon, {
                color: isActive ? "var(--accent-color)" : "var(--nav-icon)",
              })}
              <span>{item.label}</span>
              {showBadge && (
                <span
                  style={{
                    position: "absolute",
                    right: 23,
                    top: 14,
                    background: "#ff4949",
                    color: "#fff",
                    minWidth: 18,
                    height: 18,
                    borderRadius: "50%",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 4px #0001",
                    zIndex: 2,
                  }}
                >
                  {unreadChatsCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div
        onClick={handleLogout}
        style={{
          cursor: "pointer",
          marginBottom: 26,
          textAlign: "center",
          opacity: 0.92,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          justifyContent: "center",
          padding: "13px 0",
          borderTop: "1px solid var(--border-card)",
        }}
      >
        <FiLogOut size={24} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {t("Logout", "Çıkış Yap")}
        </span>
      </div>
    </div>
  );
}
