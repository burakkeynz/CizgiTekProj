import React from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout failed, but proceeding anyway.");
    } finally {
      navigate("/goodbye");
    }
  };

  return (
    <div
      style={{
        width: 90,
        background: "#38404a",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 36,
        minHeight: "100vh",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            fontWeight: "bold",
            fontSize: 28,
            marginBottom: 30,
            letterSpacing: 2,
          }}
        >
          M
        </div>
        <Link
          to="/logs"
          style={{
            marginBottom: 22,
            color: "#fff",
            textDecoration: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: 0.9,
            fontWeight: "bold",
          }}
        >
          <span style={{ fontSize: 24 }}>📚</span>
          <span style={{ fontSize: 13, marginTop: 2 }}>Logs</span>
        </Link>
        {/* Dummy iconlar */}
        <div style={{ marginBottom: 22, opacity: 0.7 }}>📊</div>
        <div style={{ marginBottom: 22, opacity: 0.7 }}>📁</div>
        <div style={{ marginBottom: 22, opacity: 0.7 }}>⚙️</div>
      </div>

      <div
        onClick={handleLogout}
        style={{
          cursor: "pointer",
          marginBottom: 20,
          textAlign: "center",
          opacity: 0.85,
        }}
      >
        <div style={{ fontSize: 20 }}>🚪</div>
        <div style={{ fontSize: 12, marginTop: 2 }}>Logout</div>
      </div>
    </div>
  );
}

export default Navbar;
