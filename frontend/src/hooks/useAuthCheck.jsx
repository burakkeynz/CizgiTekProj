import { useEffect, useState } from "react";
import api from "../api";

export default function useAuthCheck(shouldRun = true) {
  const [hasSession, setHasSession] = useState(null); // null olmazsa burası f5 e sebep veriyordu

  useEffect(() => {
    if (!shouldRun) {
      setHasSession(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await api.get("/auth/me");
        console.log("✅ useAuthCheck success:", res.data);
        setHasSession(true);
      } catch (err) {
        console.warn("❌ useAuthCheck failed:", err.response?.status);
        setHasSession(false);
      }
    };

    checkAuth();
  }, [shouldRun]);

  return hasSession;
}
