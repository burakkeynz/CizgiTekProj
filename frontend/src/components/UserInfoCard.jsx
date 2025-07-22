import { useEffect, useState } from "react";

function UserInfoCard({ user, expiresIn }) {
  const [timeLeft, setTimeLeft] = useState(expiresIn);

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
