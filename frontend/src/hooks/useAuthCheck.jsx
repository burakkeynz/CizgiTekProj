import { useEffect, useState, useRef } from "react";
import api from "../api";

export default function useAuthCheck(shouldRun = true) {
  const [hasSession, setHasSession] = useState(() => (shouldRun ? null : true));
  const [user, setUser] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef();

  useEffect(() => {
    if (!shouldRun) return;

    let cancelled = false;

    const checkAuth = async () => {
      try {
        const res = await api.get("/auth/me");
        if (cancelled) return;
        setUser({
          username: res.data.username,
          first_name: res.data.first_name,
          last_name: res.data.last_name,
          role: res.data.role,
          status: res.data.status, //şimdi eklendi, useAuthCheck artık /me'deki statusu de kontrol ediyor ki f5 olursa status güncel kalsın
        });
        setExpiresIn(res.data.expires_in);

        if (res.data.expires_in <= 0) {
          setExpired(true);
          setHasSession(false);
        } else {
          setExpired(false);
          setHasSession(true);
        }
      } catch (err) {
        setUser(null);
        setHasSession(false);
        if (err?.response?.data?.detail === "Token expired") {
          setExpired(true);
        } else {
          setExpired(false);
        }
      }
    };

    checkAuth();

    intervalRef.current = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setExpired(true);
          setHasSession(false);
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
  }, [shouldRun]);

  return { hasSession, user, expiresIn, expired };
}
