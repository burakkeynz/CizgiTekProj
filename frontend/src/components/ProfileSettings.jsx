import React, { useEffect, useState } from "react";
import api from "../api";

export default function ProfileSettings() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get("/auth/me").then((res) => setUser(res.data));
  }, []);

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h2
        style={{
          color: "var(--accent-color)",
          marginBottom: 22,
          textAlign: "center",
          fontWeight: 700,
          letterSpacing: ".4px",
        }}
      >
        Profile
      </h2>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Username</label>
        <input value={user.username} disabled style={inputStyle} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Name</label>
        <input
          value={user.first_name + " " + user.last_name}
          disabled
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Role</label>
        <input value={user.role} disabled style={inputStyle} />
      </div>

      {user.role === "doctor" && (
        <div
          style={{
            color: "var(--accent-color)",
            marginTop: 18,
            fontWeight: 500,
          }}
        >
          Doktorlar için ekstra ayar: <b>Poliklinik Seçimi</b>
        </div>
      )}
      {user.role === "technician" && (
        <div style={{ color: "#17a2b8", marginTop: 18, fontWeight: 500 }}>
          Teknisyenler için ekstra ayar: <b>Departman Seçimi</b>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  fontWeight: 600,
  color: "var(--text-main)",
  fontSize: 15,
  marginBottom: 3,
  display: "block",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "1.5px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-main)",
  fontSize: 16,
  marginTop: 3,
  outline: "none",
  transition: "background 0.18s, color 0.18s",
};
