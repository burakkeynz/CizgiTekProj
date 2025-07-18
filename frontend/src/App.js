import React, { useRef, useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import useAuthCheck from "./hooks/useAuthCheck";

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
  const location = useLocation();
  const navigate = useNavigate();
  const alreadyRedirected = useRef(false);

  const pathname = location.pathname;
  const publicRoutes = ["/login", "/register", "/session-expired", "/goodbye"];
  const isPublicRoute = publicRoutes.includes(pathname);
  const shouldCheckSession = !isPublicRoute;

  const hasSession = useAuthCheck(shouldCheckSession);

  // route değişince yönlendirme sıfırlama
  useEffect(() => {
    alreadyRedirected.current = false;
  }, [pathname]);

  // // Debug log
  // useEffect(() => {
  //   console.log("App.js RENDER");
  //   console.log("Path:", pathname);
  //   console.log("shouldCheckSession:", shouldCheckSession);
  //   console.log("hasSession:", hasSession);
  //   console.log("isPublicRoute:", isPublicRoute);
  // }, [pathname, shouldCheckSession, hasSession, isPublicRoute]);

  // oturum kontrolü tamamlandıysa yönlendiriyorum
  useEffect(() => {
    if (alreadyRedirected.current) return;

    if (hasSession === false && shouldCheckSession) {
      alreadyRedirected.current = true;
      navigate("/session-expired", { replace: true });
      return;
    }

    if (hasSession === true && isPublicRoute) {
      alreadyRedirected.current = true;
      navigate("/dashboard", { replace: true });
      return;
    }
  }, [hasSession, isPublicRoute, shouldCheckSession, pathname, navigate]);

  // oturum kontrolü sürerken boş ekran göstertiyorum
  if (shouldCheckSession && hasSession === null) return null;

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
