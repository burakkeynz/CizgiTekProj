import { useEffect } from "react";
import api from "../api";

function SessionExpired() {
  useEffect(() => {
    // Sayfa açılır açılmaz cookie'yi temizle
    api.post("/auth/logout").catch(() => {});
  }, []);

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
        <span style={{ fontSize: 54, color: "#0066ff", marginBottom: 14 }}>
          😕
        </span>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 14 }}>
          Oturumunuz sona erdi
        </div>
        <div style={{ marginBottom: 20 }}>Lütfen tekrar giriş yapın.</div>
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

export default SessionExpired;
