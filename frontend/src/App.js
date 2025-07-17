import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Assistant from "./components/Assistant";
import Main from "./components/Main";
import Logs from "./components/Logs";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import SessionExpired from "./components/SessionExpired";
import Goodbye from "./components/Goodbye";

function App() {
  const [hasSession, setHasSession] = useState(null); // null = kontrol edilmedi
  const location = useLocation();
  const navigate = useNavigate();

  const isPublicRoute = [
    "/login",
    "/register",
    "/session-expired",
    "/goodbye",
  ].includes(location.pathname);

  useEffect(() => {
    const cookies = document.cookie;
    const hasAccessToken = cookies.includes("access_token=");
    setHasSession(hasAccessToken);

    if (!hasAccessToken && !isPublicRoute) {
      navigate("/session-expired");
    }

    if (hasAccessToken && isPublicRoute) {
      navigate("/");
    }
  }, [location.pathname]);

  if (hasSession === null) {
    return null; // ilk kontrol yapılana kadar bekle
  }

  const showLayout = hasSession && !isPublicRoute;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {showLayout && <Navbar />}
      <div style={{ flex: 1, minHeight: "100vh" }}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/session-expired" element={<SessionExpired />} />
          <Route path="/goodbye" element={<Goodbye />} />
        </Routes>
      </div>
      {showLayout && (
        <div
          style={{
            width: 360,
            minWidth: 320,
            background: "#f8fafc",
            borderLeft: "1.5px solid #e4e8ef",
            boxShadow: "-1px 0 10px #dde1e6",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Assistant />
        </div>
      )}
    </div>
  );
}

export default App;
