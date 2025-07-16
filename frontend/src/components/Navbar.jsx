import React from "react";

function Navbar() {
  return (
    <div
      style={{
        width: 90,
        background: "#38404a",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 36,
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          fontSize: 28,
          marginBottom: 30,
          letterSpacing: 2,
        }}
      >
        M
      </div>
      {/* Dummy bırakıyotuz şimdilik */}
      <div style={{ marginBottom: 22, opacity: 0.7 }}>📊</div>
      <div style={{ marginBottom: 22, opacity: 0.7 }}>📁</div>
      <div style={{ marginBottom: 22, opacity: 0.7 }}>⚙️</div>
    </div>
  );
}

export default Navbar;
