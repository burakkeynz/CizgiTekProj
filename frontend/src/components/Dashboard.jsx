import React from "react";
import logo from "../assets/logo.png";

function Dashboard() {
  return (
    <div
      style={{
        flex: 1,
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #f8fbff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1
        style={{
          fontSize: 38,
          fontWeight: 800,
          color: "#1e3365",
          letterSpacing: 1,
          marginBottom: 16,
        }}
      >
        Hoş Geldiniz!
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
          color: "#4778b0",
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.4,
          maxWidth: 400,
        }}
      >
        Hastane Panel Sistemi
        <br />
        <span style={{ fontWeight: 400, fontSize: 17, color: "#84a2cd" }}>
          Kolayca görüşün, danışın ve erişin
        </span>
      </div>
    </div>
  );
}

export default Dashboard;
