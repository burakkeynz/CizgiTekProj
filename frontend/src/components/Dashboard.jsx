import React from "react";

function Dashboard() {
  return (
    <div
      style={{
        flex: 1,
        padding: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: "#38404a",
          marginBottom: 14,
        }}
      >
        Dashboard
      </h1>
      <div style={{ color: "#9aa4b1", fontSize: 17 }}>
        Burada özet ve istatistik bilgileri gözükecek
      </div>
    </div>
  );
}

export default Dashboard;
