import { useEffect, useState } from "react";

function UserInfoCard({ user, expiresIn }) {
  const [timeLeft, setTimeLeft] = useState(expiresIn);

  useEffect(() => {
    setTimeLeft(expiresIn);
    if (!expiresIn || expiresIn <= 0) return;

    // 1. Tam expire anında yönlendirme!
    const timeout = setTimeout(() => {
      window.location.href = "/session-expired";
    }, expiresIn * 1000);

    // 2. Geriye sayan countdown
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
        borderBottom: "1.5px solid #e4e8ef",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: "#e7f0fd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 7,
          fontSize: 32,
          fontWeight: 700,
          color: "#0066ff",
        }}
      >
        {user.first_name?.[0]?.toUpperCase() || "U"}
      </div>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 3 }}>
        {fullName}
      </div>
      <div
        style={{
          background: "#f3f6fa",
          borderRadius: 8,
          padding: "5px 12px",
          fontSize: 14,
          fontWeight: 500,
          color: "#0066ff",
        }}
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}

export default UserInfoCard;
