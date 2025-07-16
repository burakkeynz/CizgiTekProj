import React from "react";
import Navbar from "./Navbar";
import Main from "./Main";
import Assistant from "./Assistant";

function Dashboard() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 320px",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      {/* Navbar kısmı */}
      <div
        style={{
          gridColumn: "1 / 2",
          gridRow: "1 / 2",
          zIndex: 2,
          background: "#38404a",
          boxShadow: "2px 0 8px #dde1e6",
        }}
      >
        <Navbar />
      </div>

      {/* WebRTC olsun Main olsun vs */}
      <div
        style={{
          gridColumn: "2 / 3",
          gridRow: "1 / 2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Main />
      </div>

      {/* Profil ve Chat kısmı için ayırdıgım alan */}
      <div
        style={{
          gridColumn: "3 / 4",
          gridRow: "1 / 2",
          background: "#f8fafc",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "24px 0",
          borderLeft: "1.5px solid #e4e8ef",
          boxShadow: "-1px 0 10px #dde1e6",
        }}
      >
        <div
          style={{
            width: 285,
            maxWidth: "100%",
            minHeight: 380,
          }}
        >
          <Assistant />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
