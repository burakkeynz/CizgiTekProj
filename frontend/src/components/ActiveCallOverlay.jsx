import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import ActiveCall from "./ActiveCall";
import { Rnd } from "react-rnd";

const MINIMIZED_SIZE = { width: 170, height: 38 };
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

  const width = minimized ? MINIMIZED_SIZE.width : panelRect.width; //-24  vardı kaldırarak test ediyorum bi
  const height = minimized ? MINIMIZED_SIZE.height : 220;
  const x = panelRect.left; //+12 vardı kaldırarak test ediyorum bi
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
          // DİKKAT: Burada hiç bir shadow, border, bg OLMAYACAK!
          boxShadow: "none",
          background: "none",
          borderRadius: 0,
          overflow: "visible",
        }}
        enableResizing={!minimized}
        dragHandleClassName="draggable-bar"
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
          }}
        >
          {!minimized ? (
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
                  background: "rgba(30,38,56,0.13)",
                }}
              />
              <ActiveCall
                socket={socket}
                currentUser={currentUser}
                onMinimize={() => setMinimized(true)}
                minimized={false}
              />
            </div>
          ) : (
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
          )}
        </div>
      </Rnd>
    </div>
  );
}
