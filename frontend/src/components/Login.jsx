import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    marginBottom: "15px",
    borderRadius: "6px",
    border: "1px solid #007BFF",
    fontSize: "1rem",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    width: "100%",
    padding: "12px",
    backgroundColor: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "1rem",
    cursor: "pointer",
    fontWeight: "bold",
    boxSizing: "border-box",
    transition: "background-color 0.3s",
  };

  const handleLogin = async () => {
    const data = new URLSearchParams();
    data.append("username", username);
    data.append("password", password);

    try {
      await api.post("/auth/token", data);

      // navigate kullandım ama window.location.href de olabilir emin dğeilim, revise: window olmalı navigate problem yaratıyor
      // navigate("/dashboard");
      window.location.reload();

      // Eğer useAuthCheck hook "cookie geldiyse session var" gibi anlayacak kadar hızlı değilse:
      // window.location.href = "/dashboard"; // garanti olabilir
    } catch (err) {
      alert("Login failed, check your credentials");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #ffffff, #f0f2f5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Segoe UI, sans-serif",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "30px",
          borderRadius: "8px",
          border: "1px solid #007BFF",
          boxShadow: "0 4px 12px rgba(0, 123, 255, 0.15)",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            backgroundColor: "#28a745",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="#fff"
            viewBox="0 0 24 24"
          >
            <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
          </svg>
        </div>

        <h2 style={{ marginBottom: "20px", color: "#007BFF" }}>Login</h2>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={handleLogin}
          style={buttonStyle}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#218838")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "#28a745")}
        >
          Login
        </button>

        <p style={{ marginTop: "20px", fontSize: "0.9rem", color: "#666" }}>
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
