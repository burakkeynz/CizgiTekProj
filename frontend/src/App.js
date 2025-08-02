import React, { useRef, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import store from "./store";
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
import ChatDetail from "./components/ChatDetail";
import Settings from "./components/Settings";
import PatientDetail from "./components/PatientDetail";
import api from "./api";
import { io } from "socket.io-client";
import CallModal from "./components/CallModal";
import ActiveCallOverlay from "./components/ActiveCallOverlay";
import { useSelector, useDispatch } from "react-redux";
import { receiveCall } from "./store/callSlice";

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
  const [socket, setSocket] = useState(null);

  const call = useSelector((state) => state.call);
  const dispatch = useDispatch();

  useEffect(() => {
    if (hasSession !== true || !user || !user.id) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }
    if (socket) return;
    const s = io(process.env.REACT_APP_SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      secure: true,
      rejectUnauthorized: false,
    });
    setSocket(s);

    s.on("connect", () => {
      s.emit("join", { user_id: user.id });
    });
    s.on("connect_error", (err) => console.error("❌ SOCKET error", err));

    return () => {
      s.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!socket) return;
    const onOffer = (data) => {
      console.log("[DEBUG][GLOBAL][WebRTC][OFFER] ALINDI (App.js):", data);
      dispatch(receiveCall(data));
    };
    socket.on("webrtc_offer", onOffer);
    return () => socket.off("webrtc_offer", onOffer);
  }, [socket, dispatch]);

  useEffect(() => {
    alreadyRedirected.current = false;
  }, [pathname]);

  const handleNewLog = (log) => setLogs((prev) => [log, ...prev]);
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

  //Debug
  useEffect(() => {
    if (!socket) return;
    const onOffer = (data) => {
      console.log("[DEBUG][App.js][OFFER] Alındı:", data);
      dispatch(receiveCall(data));
      setTimeout(() => {
        // Redux state'i gerçekten güncelleniyor mu?
        const call = store.getState().call;
        console.log("[DEBUG][App.js][AFTER_DISPATCH] call slice:", call);
      }, 300);
    };
    socket.on("webrtc_offer", onOffer);
    return () => socket.off("webrtc_offer", onOffer);
  }, [socket, dispatch]);

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
        position: "relative",
      }}
    >
      {showLayout && <Navbar />}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route
            path="/chat"
            element={<Chat currentUser={user} socket={socket} />}
          >
            <Route path=":conversationId" element={<ChatDetail />} />
          </Route>
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
      {showLayout && <CallModal socket={socket} currentUser={user} />}
      {showLayout && <ActiveCallOverlay socket={socket} currentUser={user} />}
    </div>
  );
}
export default App;
