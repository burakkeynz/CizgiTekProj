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
import api from "../api";

const NAV_ITEMS = [
  {
    label: "Home",
    to: "/dashboard",
    icon: <FiHome size={26} />,
  },
  {
    label: "Patients",
    to: "/patients",
    icon: <FiUsers size={26} />,
  },
  {
    label: "Sessions",
    to: "/sessions",
    icon: <FiVideo size={26} />,
  },
  {
    label: "Chats",
    to: "/chat",
    icon: <FiMessageCircle size={26} />,
  },
  {
    label: "Logs",
    to: "/logs",
    icon: <FiFileText size={26} />,
  },
  {
    label: "Settings",
    to: "/settings",
    icon: <FiSettings size={26} />,
  },
];

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

  const handleLogout = async () => {
    try {
      localStorage.setItem("last_theme", theme);
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
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 15,
              padding: "14px 30px",
              color: location.pathname.startsWith(item.to)
                ? "var(--accent-color)"
                : "var(--text-main)",
              background: location.pathname.startsWith(item.to)
                ? "var(--nav-bg-active)"
                : "var(--nav-bg)",
              fontWeight: location.pathname.startsWith(item.to) ? "bold" : 400,
              textDecoration: "none",
              fontSize: 16,
              borderRadius: 12,
              marginBottom: 8,
              transition: "all 0.17s",
            }}
          >
            {React.cloneElement(item.icon, {
              color: location.pathname.startsWith(item.to)
                ? "var(--accent-color)"
                : "var(--nav-icon)",
            })}

            <span>{item.label}</span>
          </Link>
        ))}
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
        <span style={{ fontSize: 14, fontWeight: 500 }}>Logout</span>
      </div>
    </div>
  );
}

export default Navbar;
