import React, { useRef, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import useAuthCheck from "./hooks/useAuthCheck";

import Navbar from "./components/Navbar";
import Assistant from "./components/Assistant";
import UserInfoCard from "./components/UserInfoCard";
import Main from "./components/Main";
import Logs from "./components/Logs";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import SessionExpired from "./components/SessionExpired";
import Goodbye from "./components/Goodbye";
import ChatLogDetail from "./components/ChatLogDetail";
import Patients from "./components/Patients";
import Sessions from "./components/Sessions";
import Chat from "./components/Chat";
import Settings from "./components/Settings";
import PatientDetail from "./components/PatientDetail";
import api from "./api";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const alreadyRedirected = useRef(false);

  const pathname = location.pathname;

  const authCheckRoutes = [
    "/login",
    "/register",
    "/session-expired",
    "/goodbye",
  ];
  const isPublicRoute = authCheckRoutes.includes(pathname);
  const shouldCheckSession = !isPublicRoute;

  const { hasSession, user, expiresIn, expired } =
    useAuthCheck(shouldCheckSession);

  const [logs, setLogs] = useState([]);
  useEffect(() => {
    alreadyRedirected.current = false;
  }, [pathname]);

  const handleNewLog = (log) => {
    setLogs((prev) => [log, ...prev]);
  };

  const handleDelete = async (id) => {
    if (typeof id === "string" && id.startsWith("temp-")) {
      setLogs((prev) => prev.filter((log) => log.id !== id));
      return;
    }
    try {
      await api.delete(`/chatlogs/${id}`);
      setLogs((prev) => prev.filter((log) => log.id !== id));
    } catch (e) {}
  };

  useEffect(() => {
    if (hasSession) {
      api
        .get("/chatlogs/")
        .then((res) => setLogs(res.data))
        .catch(() => {});
    }
  }, [hasSession]);

  useEffect(() => {
    if (alreadyRedirected.current) return;

    if (hasSession === false && shouldCheckSession) {
      alreadyRedirected.current = true;

      if (expired) {
        navigate("/session-expired", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }

      return;
    }

    if (
      hasSession === true &&
      (pathname === "/login" || pathname === "/register")
    ) {
      alreadyRedirected.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [hasSession, shouldCheckSession, pathname, expired, navigate]);

  if (hasSession === null) return null;
  const showLayout = hasSession === true && !isPublicRoute;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg-main)",
      }}
    >
      {showLayout && <Navbar />}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/logs"
            element={<Logs logs={logs} onDelete={handleDelete} />}
          />
          <Route path="/logs/:id" element={<ChatLogDetail logs={logs} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/session-expired" element={<SessionExpired />} />
          <Route path="/goodbye" element={<Goodbye />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
        </Routes>
      </div>
      {showLayout && (
        <div
          style={{
            width: 360,
            minWidth: 320,
            borderLeft: "1.5px solid var(--border-card)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "var(--card-bg)",
            transition: "background 0.18s, color 0.18s",
          }}
        >
          {user && <UserInfoCard user={user} expiresIn={expiresIn} />}
          <Assistant onNewLog={handleNewLog} />
        </div>
      )}
    </div>
  );
}

export default App;
