function UserInfoCard({ user, expiresIn }) {
  // Kalan süreyi "mm:ss" formatına çevir
  const formatTime = (s) => {
    if (s == null) return "--:--";
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, "0")}:${sec
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        width: "100%",
        padding: 22,
        borderBottom: "1.5px solid #e4e8ef",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Profil foto (placeholder, ileride user'dan eklenir) */}
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
        {user.first_name?.[0] || "U"}
      </div>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 3 }}>
        {user.username}
      </div>
      <div style={{ fontSize: 14, color: "#7da1d1", marginBottom: 6 }}>
        {user.role}
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
        Token Süresi: {formatTime(expiresIn)}
      </div>
    </div>
  );
}
export default UserInfoCard;
