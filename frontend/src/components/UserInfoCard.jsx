import { useEffect, useState } from "react";
import api from "../api";

function UserInfoCard({ user, setUser, expiresIn }) {
  const [timeLeft, setTimeLeft] = useState(expiresIn);
  const [status, setStatus] = useState(user.status || "online");

  useEffect(() => {
    setTimeLeft(expiresIn);
    if (!expiresIn || expiresIn <= 0) return;

    const timeout = setTimeout(() => {
      window.location.href = "/session-expired";
    }, expiresIn * 1000);

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [expiresIn]);

  useEffect(() => {
    setStatus(user.status || "online");
  }, [user.status]);

  const handleStatusChange = async (e) => {
    const selected = e.target.value;
    setStatus(selected);
    try {
      await api.put("/users/update-status", { status: selected });
      setUser((prev) => ({ ...prev, status: selected }));
    } catch (err) {
      console.warn("Durum güncellenemedi:", err);
    }
  };

  if (!user) return null;

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, "0")}:${sec
      .toString()
      .padStart(2, "0")}`;
  };

  const fullName = `${user.role} ${user.first_name} ${user.last_name}`;

  return (
    <div
      style={{
        padding: 22,
        borderBottom: "1.5px solid var(--input-border)",
        background: "var(--card-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: "var(--accent-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 7,
          fontSize: 32,
          fontWeight: 700,
          color: "#fff",
          boxShadow: "0 2px 8px #2468ab15",
        }}
      >
        {user.first_name?.[0]?.toUpperCase() || "U"}
      </div>

      <div
        style={{
          fontWeight: 600,
          fontSize: 18,
          marginBottom: 3,
          color: "var(--text-main)",
        }}
      >
        {fullName}
      </div>

      <select
        value={status}
        onChange={handleStatusChange}
        style={{
          marginBottom: 10,
          padding: "6px 12px",
          borderRadius: 8,
          fontWeight: 500,
          fontSize: 14,
          color: "var(--text-main)",
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
        }}
      >
        <option value="online">🟢 Çevrimiçi</option>
        <option value="busy">🟠 Meşgul</option>
        <option disabled value="oncall">
          🔴 Aramada
        </option>
        <option disabled value="offline">
          ⚪ Çevrimdışı
        </option>
      </select>

      <div
        style={{
          background: "var(--input-bg)",
          borderRadius: 8,
          padding: "5px 12px",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--accent-color)",
          boxShadow: "0 1px 4px #c7d1e625",
        }}
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}

export default UserInfoCard;
