import { useEffect, useState } from "react";
import api from "../api";

export default function useAuthCheck(shouldRun = true) {
  const [hasSession, setHasSession] = useState(() => (shouldRun ? null : true));
  const [user, setUser] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);
  const [expired, setExpired] = useState(false); // ✅ eklendi

  useEffect(() => {
    if (!shouldRun) return;

    const checkAuth = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser({
          username: res.data.username,
          first_name: res.data.first_name,
          last_name: res.data.last_name,
          role: res.data.role,
        });
        setExpiresIn(res.data.expires_in);
        setExpired(false); // token geçerli
        setHasSession(true);
      } catch (err) {
        setUser(null);
        setHasSession(false);
        if (err?.response?.data?.detail === "Token expired") {
          setExpired(true); // expire olan token
        } else {
          setExpired(false); // diğer hatalar (örn: cookie hiç yok)
        }
      }
    };

    checkAuth();
  }, [shouldRun]);

  return { hasSession, user, expiresIn, expired };
}
