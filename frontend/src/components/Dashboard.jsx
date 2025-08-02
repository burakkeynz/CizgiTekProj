import React from "react";
import logo from "../assets/logo.png";

function Dashboard() {
  return (
    <div
      style={{
        flex: 1,
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, var(--bg-main) 0%, var(--card-bg) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.2s",
      }}
    >
      <h1
        style={{
          fontSize: 38,
          fontWeight: 800,
          color: "var(--accent-color)",
          letterSpacing: 1,
          marginBottom: 16,
        }}
      >
        Welcome!
      </h1>
      <img
        src={logo}
        alt="Logo"
        style={{
          width: 120,
          height: 120,
          marginBottom: 26,
          borderRadius: 32,
          boxShadow: "0 2px 24px #bfd6ff77",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          fontSize: 20,
          color: "var(--text-main)",
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.4,
          maxWidth: 400,
        }}
      >
        Hospital Panel System
        <br />
        <span
          style={{ fontWeight: 400, fontSize: 17, color: "var(--text-muted)" }}
        >
          Easily meet, consult and access
        </span>
      </div>
    </div>
  );
}

export default Dashboard;
