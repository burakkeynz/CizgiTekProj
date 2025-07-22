import React from "react";
import { useTheme } from "./ThemeContext";
import api from "../api";

// Tema switch bileşeni
function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const handleToggle = () => {
    const newTheme = isDark ? "light" : "dark";
    setTheme(newTheme);
    // Login öncesi kullanıcı seçimi pending_theme olarak kaydediliyor
    localStorage.setItem("pending_theme", newTheme);
  };

  return (
    <label
      title={isDark ? "Açık moda geç" : "Koyu moda geç"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 44,
          height: 24,
          background: isDark ? "#374151" : "#e5e7eb",
          borderRadius: 20,
          position: "relative",
          transition: "background 0.18s",
        }}
        onClick={handleToggle}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleToggle();
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: isDark ? 22 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: isDark ? "#4da5ff" : "#fff",
            boxShadow: "0 2px 6px #0002",
            transition: "left 0.18s, background 0.18s",
          }}
        />
      </span>
    </label>
  );
}

function Login() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  // Sayfa ilk mount olduğunda pending_theme uyguluyorum (varsa)
  React.useEffect(() => {
    const pending = localStorage.getItem("pending_theme");
    if (pending) setTheme(pending);
  }, [setTheme]);

  const handleLogin = async () => {
    setError("");
    const data = new URLSearchParams();
    data.append("username", username);
    data.append("password", password);

    try {
      await api.post("/auth/token", data);
      // Login başarılı olursa pending_themei uyguluyorum ve temizleme
      const pendingTheme = localStorage.getItem("pending_theme");
      if (pendingTheme) {
        setTheme(pendingTheme);
        localStorage.setItem("theme", pendingTheme);
        localStorage.removeItem("pending_theme");
      }
      window.location.reload();
    } catch {
      setError("Login failed, check your credentials");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDark
          ? "linear-gradient(135deg, #23272f, #15181c 80%)"
          : "linear-gradient(135deg, #ffffff, #f0f2f5 80%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Segoe UI, sans-serif",
        padding: "20px",
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          background: isDark ? "#1c1f23" : "#fff",
          padding: "34px 32px 24px 32px",
          borderRadius: "11px",
          border: isDark ? "1.5px solid #23272f" : "1.5px solid #007BFF",
          boxShadow: isDark ? "0 4px 24px #16192555" : "0 4px 16px #83bfff22",
          width: "100%",
          maxWidth: 390,
          minWidth: 290,
          textAlign: "center",
          color: isDark ? "#ecf1fa" : "#23272f",
          transition: "background 0.2s, border 0.2s, color 0.2s",
        }}
      >
        {/* switch */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 18,
            marginTop: -8,
          }}
        >
          <ThemeSwitch />
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: ".2px",
            marginBottom: 9,
            color: isDark ? "#4da5ff" : "#2d6be7",
            textAlign: "center",
          }}
        >
          Login
        </div>

        <div
          style={{
            width: 55,
            height: 55,
            borderRadius: "50%",
            background: isDark ? "#4da5ff" : "#28a745",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "0 auto 18px auto",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            fill="#fff"
            viewBox="0 0 24 24"
          >
            <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
          </svg>
        </div>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "13px 16px",
            marginBottom: 13,
            borderRadius: "7px",
            border: isDark ? "1.3px solid #384969" : "1.3px solid #007BFF",
            fontSize: "1rem",
            background: isDark ? "#23272f" : "#fff",
            color: isDark ? "#ecf1fa" : "#23272f",
            outline: "none",
            transition: "background 0.17s, color 0.17s, border 0.17s",
            fontWeight: 500,
          }}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "13px 16px",
            marginBottom: 13,
            borderRadius: "7px",
            border: isDark ? "1.3px solid #384969" : "1.3px solid #007BFF",
            fontSize: "1rem",
            background: isDark ? "#23272f" : "#fff",
            color: isDark ? "#ecf1fa" : "#23272f",
            outline: "none",
            transition: "background 0.17s, color 0.17s, border 0.17s",
            fontWeight: 500,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "12px",
            background: isDark ? "#4da5ff" : "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "1rem",
            cursor: "pointer",
            fontWeight: "bold",
            marginBottom: 10,
            transition: "background 0.17s",
          }}
        >
          Login
        </button>

        {error && (
          <div
            style={{
              marginBottom: 10,
              color: "#e53749",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {error}
          </div>
        )}

        <p
          style={{
            marginTop: "12px",
            fontSize: "0.96rem",
            color: isDark ? "#b6c4d2" : "#666",
          }}
        >
          Don't you have an account?{" "}
          <a href="/register" style={{ color: "#dc3545", fontWeight: "bold" }}>
            Register
          </a>
        </p>
      </div>
    </div>
  );
}

export default Login;
