import React from "react";
import { useNavigate } from "react-router-dom";

function Goodbye() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          padding: "48px 40px",
          borderRadius: 16,
          boxShadow: "0 4px 32px #dbeafe45",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 54, color: "#22c55e", marginBottom: 14 }}>
          👋
        </span>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 14 }}>
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
          }}
        >
          Login
        </a>
      </div>
    </div>
  );
}

export default Goodbye;
