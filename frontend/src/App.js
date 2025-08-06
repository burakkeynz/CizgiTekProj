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
import ChatDetail from "./components/ChatDetail";
import Settings from "./components/Settings";
import PatientDetail from "./components/PatientDetail";
import api from "./api";
import { io } from "socket.io-client";
import CallModal from "./components/CallModal";
import ActiveCallOverlay from "./components/ActiveCallOverlay";
import { useDispatch } from "react-redux";
import { receiveCall } from "./store/callSlice";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
  const {
    hasSession,
    user: userFromAuth,
    expiresIn,
    expired,
  } = useAuthCheck(shouldCheckSession);

  // Local user state (for both F5 refresh and live status)
  const [user, setUser] = useState(userFromAuth);
  const [conversations, setConversations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [socket, setSocket] = useState(null);

  const dispatch = useDispatch();

  //Sekme kapatılınca da status'ü offlinea çevirme
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (window.socket && user && user.id) {
        window.socket.emit("user_status", {
          user_id: user.id,
          status: "offline",
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user, socket]);

  // Sync user from useAuthCheck
  useEffect(() => {
    setUser(userFromAuth);
  }, [userFromAuth]);

  // Load conversations when session is active
  useEffect(() => {
    if (hasSession) {
      api
        .get("/conversations/my")
        .then((res) => setConversations(res.data))
        .catch(() => {});
    }
  }, [hasSession]);

  // Socket connection & status update logic
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
    window.socket = s;

    s.on("connect", () => {
      s.emit("join", { user_id: user.id });
      s.emit("user_status", { user_id: user.id, status: "online" }); //giriş yapıldıgında da anlık online görüntüsü alabilmem için ekledim
    });
    s.on("connect_error", (err) => console.error("❌ SOCKET error", err));
    s.on("user_status_update", (data) => {
      if (String(data.user_id) === String(user.id)) {
        setUser((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.user && String(conv.user.id) === String(data.user_id)
            ? {
                ...conv,
                user: {
                  ...conv.user,
                  status: data.status,
                },
              }
            : conv
        )
      );
    });

    return () => {
      s.disconnect();
    };
  }, [user?.id, hasSession]);

  useEffect(() => {
    if (!socket) return;
    const onOffer = (data) => {
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

  useEffect(() => {
    if (hasSession) {
      api
        .get("/chatlogs/")
        .then((res) => setLogs(res.data))
        .catch(() => {});
    }
  }, [hasSession]);

  //Şimdi ekliyorum
  useEffect(() => {
    if (!socket) return;
    const handleUnreadUpdate = (data) => {
      // data: { conversation_id, user_id, unread_count }
      setConversations((prev) =>
        prev.map((c) =>
          String(c.conversation_id) === String(data.conversation_id)
            ? { ...c, unread_count: data.unread_count }
            : c
        )
      );
    };
    socket.on("unread_count_update", handleUnreadUpdate);
    return () => {
      socket.off("unread_count_update", handleUnreadUpdate);
    };
  }, [socket, setConversations]);

  useEffect(() => {
    if (!socket) return;

    socket.on("new_conversation", (data) => {
      const { conversation_id, sender_info, content, timestamp } = data;

      setConversations((prev) => {
        const exists = prev.some(
          (c) => String(c.user.id) === String(sender_info.id)
        );
        if (exists) return prev;

        return [
          {
            conversation_id,
            user: {
              id: sender_info.id,
              first_name: sender_info.first_name,
              last_name: sender_info.last_name,
              username: sender_info.username,
              profile_picture_url: sender_info.profile_picture_url,
              status: sender_info.status,
              role: sender_info.role,
            },
            last_message: {
              from_me: false,
              content: content,
              timestamp: timestamp,
            },
          },
          ...prev,
        ];
      });
    });

    return () => {
      socket.off("new_conversation");
    };
  }, [socket]);
  useEffect(() => {
    if (alreadyRedirected.current) return;
    if (hasSession === false && shouldCheckSession) {
      alreadyRedirected.current = true;
      const theme = localStorage.getItem("theme") || "light";
      const language = localStorage.getItem("language") || "en";
      localStorage.setItem("pending_theme", theme);
      localStorage.setItem("pending_language", language);
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
      {showLayout && <Navbar user={user} conversations={conversations} />}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route
            path="/chat"
            element={
              <Chat
                currentUser={user}
                socket={socket}
                conversations={conversations}
                setConversations={setConversations}
              />
            }
          >
            <Route
              path=":conversationId"
              element={
                <ChatDetail
                  currentUser={user}
                  socket={socket}
                  conversations={conversations}
                  setConversations={setConversations}
                />
              }
            />
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
          {user && (
            <UserInfoCard user={user} setUser={setUser} expiresIn={expiresIn} />
          )}
          <Assistant onNewLog={handleNewLog} />
        </div>
      )}
      {showLayout && (
        <CallModal socket={socket} currentUser={user} setUser={setUser} />
      )}
      {showLayout && (
        <ActiveCallOverlay
          socket={socket}
          currentUser={user}
          setUser={setUser}
        />
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
