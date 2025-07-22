import React, { useState } from "react";
import api from "../api";

export default function PasswordSettings() {
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [message, setMessage] = useState("");

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setMessage("");
    if (passwords.new !== passwords.confirm) {
      setMessage("Şifreler aynı olmalı!");
      return;
    }
    try {
      await api.put("/users/change_password", {
        password: passwords.current,
        new_password: passwords.new,
      });
      setMessage("Şifre başarıyla değişti!");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch {
      setMessage("Şifre değiştirilemedi.");
    }
  };

  return (
    <form onSubmit={handlePasswordUpdate}>
      <h2
        style={{
          color: "var(--accent-color)",
          marginBottom: 22,
          textAlign: "center",
          fontWeight: 700,
          letterSpacing: ".4px",
        }}
      >
        Şifre Değiştir
      </h2>
      <input
        type="password"
        placeholder="Mevcut Şifre"
        value={passwords.current}
        onChange={(e) =>
          setPasswords({ ...passwords, current: e.target.value })
        }
        style={inputStyle}
        autoComplete="current-password"
      />
      <input
        type="password"
        placeholder="Yeni Şifre"
        value={passwords.new}
        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
        style={inputStyle}
        autoComplete="new-password"
      />
      <input
        type="password"
        placeholder="Yeni Şifre (Tekrar)"
        value={passwords.confirm}
        onChange={(e) =>
          setPasswords({ ...passwords, confirm: e.target.value })
        }
        style={inputStyle}
        autoComplete="new-password"
      />
      <button
        type="submit"
        style={{
          width: "100%",
          background: "var(--accent-color)",
          color: "#fff",
          fontWeight: "bold",
          border: "none",
          borderRadius: 8,
          padding: 13,
          marginTop: 10,
          fontSize: 15,
          transition: "background 0.17s",
          cursor: "pointer",
        }}
      >
        Şifreyi Güncelle
      </button>
      {message && (
        <div
          style={{
            marginTop: 14,
            color: message.includes("başarıyla")
              ? "var(--accent-color)"
              : "#ea2e49",
            textAlign: "center",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          {message}
        </div>
      )}
    </form>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "1.5px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-main)",
  fontSize: 16,
  marginBottom: 13,
  outline: "none",
  transition: "background 0.18s, color 0.18s",
};
