import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import ActiveCall from "./ActiveCall";
import { Rnd } from "react-rnd";

const MINIMIZED_SIZE = { width: 170, height: 38 };
const CHAT_HEADER_HEIGHT = 74;
const OVERLAY_MARGIN_TOP = 0;

export default function ActiveCallOverlay({ socket, currentUser }) {
  const { inCall } = useSelector((state) => state.call);
  const [minimized, setMinimized] = useState(false);
  const [panelRect, setPanelRect] = useState(null);

  useEffect(() => {
    function updateRect() {
      const panel = document.getElementById("main-chat-panel");
      if (panel) setPanelRect(panel.getBoundingClientRect());
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, []);

  useEffect(() => {
    const panel = document.getElementById("main-chat-panel");
    if (panel) setPanelRect(panel.getBoundingClientRect());
  }, [minimized]);

  if (!inCall || !panelRect) return null;

  const width = minimized ? MINIMIZED_SIZE.width : panelRect.width - 24;
  const height = minimized ? MINIMIZED_SIZE.height : 220;

  // EN üstte chat panelinin tam yatay ortasında
  const x = panelRect.left + 12;
  const y = panelRect.top + OVERLAY_MARGIN_TOP;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2999,
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <Rnd
        bounds="parent"
        default={{
          x,
          y,
          width,
          height,
        }}
        minWidth={MINIMIZED_SIZE.width}
        minHeight={MINIMIZED_SIZE.height}
        disableDragging={minimized}
        style={{
          zIndex: 3000,
          pointerEvents: "auto",
          position: "absolute",
          boxShadow: "0 8px 32px #0007, 0 2px 10px #3332",
          borderRadius: minimized ? 16 : 22,
          overflow: "visible",
          background: "none",
        }}
        enableResizing={!minimized}
        dragHandleClassName="draggable-bar"
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: minimized
              ? "linear-gradient(120deg, #23293A 60%, #212a37 100%)"
              : "linear-gradient(120deg, #23293A 90%, #212a37 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: minimized ? 16 : 22,
            position: "relative",
            boxShadow: "0 4px 28px #0007",
            border: minimized ? "none" : "1.5px solid #232a38",
            borderBottom: minimized ? "none" : "2.5px solid #4c5670", // Altına ince bir çizgi ekle
          }}
        >
          {/* --- Minimize / maximize butonu --- */}
          {!minimized && (
            <button
              style={{
                position: "absolute",
                top: 10,
                right: 14,
                background: "#202a3a",
                color: "#eee",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                fontSize: 19,
                fontWeight: 600,
                cursor: "pointer",
                opacity: 0.85,
                zIndex: 20,
                transition: "background .13s",
              }}
              onClick={() => setMinimized(true)}
              title="Minimize Et"
            >
              &#8211;
            </button>
          )}
          {minimized ? (
            <button
              style={{
                background: "linear-gradient(90deg, #222 70%, #334 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                width: "100%",
                height: "100%",
                fontWeight: 600,
                fontSize: 17,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                letterSpacing: 1.2,
                opacity: 0.92,
                zIndex: 1,
              }}
              onClick={() => setMinimized(false)}
              title="Görüşmeyi Aç"
            >
              Arama aktif • Aç
            </button>
          ) : (
            <div style={{ width: "100%", height: "100%" }}>
              <div
                className="draggable-bar"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: 28,
                  width: "100%",
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  cursor: "move",
                  zIndex: 10,
                  background: "rgba(30,38,56,0.18)",
                }}
              />
              <ActiveCall socket={socket} currentUser={currentUser} />
            </div>
          )}
        </div>
      </Rnd>
    </div>
  );
}
