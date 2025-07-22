import React, { useState } from "react";
import ProfileSettings from "./ProfileSettings";
import PasswordSettings from "./PasswordSettings";
import AppearanceSettings from "./AppearanceSettings";

const SETTINGS_TABS = [
  { key: "profile", label: "Profil" },
  { key: "password", label: "Şifre Değiştir" },
  { key: "appearance", label: "Görünüm" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minHeight: "100vh",
        background: "var(--bg-main)",
        margin: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: "100vh",
          boxShadow: "0 6px 32px rgba(40,70,110,0.10)",
          background: "var(--card-bg)",
          borderTopRightRadius: 28,
          borderBottomRightRadius: 28,
          overflow: "hidden",
        }}
      >
        {/* Sol menü */}
        <div
          style={{
            width: 220,
            background: "var(--bg-muted)",
            borderRight: "1.5px solid var(--border-card)",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            padding: "32px 0",
            minHeight: "100vh",
            gap: 2,
          }}
        >
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <div
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  cursor: "pointer",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--accent-color)" : "var(--text-main)",
                  background: isActive ? "var(--nav-bg-active)" : "transparent",
                  borderLeft: isActive
                    ? "4px solid var(--accent-color)"
                    : "4px solid transparent",
                  padding: "15px 32px",
                  fontSize: 18,
                  borderRadius: "0 12px 12px 0",
                  marginRight: 8,
                  transition: "all 0.17s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "var(--nav-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {tab.label}
              </div>
            );
          })}
        </div>

        {/*sağ taraf */}
        <div
          style={{
            flex: 1,
            padding: "48px 48px",
            background: "var(--card-bg)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            minHeight: "100vh",
          }}
        >
          {activeTab === "profile" && <ProfileSettings />}
          {activeTab === "password" && <PasswordSettings />}
          {activeTab === "appearance" && <AppearanceSettings />}
        </div>
      </div>
    </div>
  );
}
