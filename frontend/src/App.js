import React, { useRef, useEffect } from "react";
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

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const alreadyRedirected = useRef(false);

  const pathname = location.pathname;

  // ✅ goodbye sayfası kontrol dışı bırakıldı
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

  useEffect(() => {
    alreadyRedirected.current = false;
  }, [pathname]);

  useEffect(() => {
    if (alreadyRedirected.current) return;

    // ⛔️ Goodbye sayfasında yönlendirme yapılmasın
    if (hasSession === false && shouldCheckSession) {
      alreadyRedirected.current = true;

      if (expired) {
        navigate("/session-expired", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }

      return;
    }

    // ✅ sadece login/register’daysan yönlendir (goodbye değil!)
    if (
      hasSession === true &&
      (pathname === "/login" || pathname === "/register")
    ) {
      alreadyRedirected.current = true;
      navigate("/dashboard", { replace: true });
    }
  }, [hasSession, shouldCheckSession, pathname, expired, navigate]);

  // auth durumu belli değilse hiçbir şey render etme
  if (hasSession === null) return null;

  const showLayout = hasSession === true && !isPublicRoute;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {showLayout && <Navbar />}
      <div style={{ flex: 1 }}>
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
            borderLeft: "1.5px solid #e4e8ef",
            boxShadow: "-1px 0 10px #dde1e6",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#fff",
          }}
        >
          {user && <UserInfoCard user={user} expiresIn={expiresIn} />}
          <Assistant />
        </div>
      )}
    </div>
  );
}

export default App;
