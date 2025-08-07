import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import ActiveCall from "./ActiveCall";
import { Rnd } from "react-rnd";
import { useLanguage } from "./LanguageContext";

const MINIMIZED_SIZE = { width: 170, height: 38 };
const OVERLAY_MARGIN_TOP = 0;

export default function ActiveCallOverlay({ socket, currentUser }) {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);
  const { inCall, peerUser, callType } = useSelector((state) => state.call);
  const [minimized, setMinimized] = useState(false);
  const [panelRect, setPanelRect] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const mutationObserverRef = useRef(null);

  // panelRect'i güncelleyen fonksiyon
  const updateRect = useCallback(() => {
    const panel = document.getElementById("main-chat-panel");
    if (panel) {
      const rect = panel.getBoundingClientRect();
      console.log("[Overlay DEBUG] Found panel, setting panelRect:", rect);
      setPanelRect(rect);
      setRetryCount(0); // Reset retry count on success
      return true;
    }
    console.log("[Overlay DEBUG] Panel not found");
    return false;
  }, []);

  // DOM hazır olduğunu garantilemek için hackimsi kodlar ekliyorum
  const forceReflow = useCallback(() => {
    // Hack 1: Force reflow
    void document.body.offsetHeight;

    //Scroll trigger
    window.scrollTo(window.scrollX, window.scrollY);

    //Resize event trigger
    window.dispatchEvent(new Event("resize"));
  }, []);

  // MutationObserver hack dom değişikliklerini izler
  const setupMutationObserver = useCallback(() => {
    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect();
    }

    mutationObserverRef.current = new MutationObserver((mutations) => {
      let shouldCheck = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          // main-chat-panel ile ilgili değişiklik var mı
          const target = mutation.target;
          if (
            target.id === "main-chat-panel" ||
            target.querySelector?.("#main-chat-panel") ||
            (target.parentElement &&
              target.parentElement.id === "main-chat-panel")
          ) {
            shouldCheck = true;
          }
        }
      });

      if (shouldCheck) {
        console.log("[Overlay DEBUG] DOM mutation detected, checking panel...");
        setTimeout(updateRect, 50);
      }
    });

    // Body izleme
    mutationObserverRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  }, [updateRect]);

  // inCall true olduğunda panelRecti bulma
  useEffect(() => {
    if (!inCall) {
      setPanelRect(null);
      setRetryCount(0);
      return;
    }

    console.log("[Overlay DEBUG] Starting panel search...");

    // MutationObserver start
    setupMutationObserver();

    //  doma force reflow ile uyandırma
    forceReflow();

    // İlk deneme - biraz daha uzun bekle
    const initialTimeout = setTimeout(() => {
      if (updateRect()) return;

      // Panel bulunamazsa retry mekanizması
      const maxRetries = 15; // Daha fazla retry
      const retryInterval = 150; // Biraz daha uzun interval

      const retryTimer = setInterval(() => {
        setRetryCount((prev) => {
          const newCount = prev + 1;
          console.log(
            `[Overlay DEBUG] Retry attempt ${newCount}/${maxRetries}`
          );

          // Her retryda force reflow
          if (newCount % 3 === 0) {
            forceReflow();
          }

          if (updateRect()) {
            clearInterval(retryTimer);
            return 0;
          }

          if (newCount >= maxRetries) {
            console.log("[Overlay DEBUG] Max retries reached, using fallback");
            clearInterval(retryTimer);
            const isOnChatPage = window.location.pathname.includes("/chat");
            if (isOnChatPage) {
              setPanelRect({
                left: 320, // Sol panel genişliği
                top: 0,
                width: window.innerWidth - 320 - 360, // Sol ve sağ panel çıkarıldı
                height: window.innerHeight,
              });
            }
            return newCount;
          }

          return newCount;
        });
      }, retryInterval);

      return () => {
        clearInterval(retryTimer);
      };
    }, 50); // İlk denemeden önce 50ms bekle

    return () => {
      clearTimeout(initialTimeout);
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
    };
  }, [inCall, updateRect, forceReflow, setupMutationObserver]);

  // Resize event listener
  useEffect(() => {
    const handleResize = () => {
      if (inCall) {
        setTimeout(updateRect, 50); // Kısa delay ile resize sonrası
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [inCall, updateRect]);

  // minimized değiştiğinde panelRecti güncelleme
  useEffect(() => {
    if (inCall && minimized !== undefined) {
      setTimeout(updateRect, 50);
    }
  }, [minimized, inCall, updateRect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
    };
  }, []);

  // Arama aktif değilse HEMEN gösterme
  if (!inCall || (!panelRect && retryCount === 0)) {
    return null;
  }

  // Panel henüz bulunamadıysa ve retry devam ediyorsa loading display
  if (!panelRect && retryCount > 0 && retryCount < 15) {
    return (
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: "10px 15px",
          borderRadius: 8,
          zIndex: 3000,
          fontSize: 14,
        }}
      >
        {t(
          "Positioning call window...",
          "Arama penceresi konumlandırılıyor..."
        )}{" "}
        ({retryCount}/15)
      </div>
    );
  }

  // Panel bulunamadıysa ve max retry aşıldıysa merkezi konum kullan
  if (!panelRect) {
    return (
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 3000,
        }}
      >
        <div
          style={{
            marginBottom: 10,
            textAlign: "center",
            color: "#fff",
            fontSize: 12,
          }}
        >
          {t(
            "Panel not found, using center position",
            "Panel bulunamadı, merkez konum kullanılıyor"
          )}
        </div>
        <ActiveCall
          socket={socket}
          currentUser={currentUser}
          onMinimize={() => setMinimized(true)}
          minimized={minimized}
        />
      </div>
    );
  }

  const width = minimized ? MINIMIZED_SIZE.width : panelRect.width;
  const height = minimized ? MINIMIZED_SIZE.height : 220;
  const x = panelRect.left;
  const y = panelRect.top + OVERLAY_MARGIN_TOP;

  console.log("[Overlay DEBUG] Rendering with:", { width, height, x, y });

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
              title={t("Open Call", "Görüşmeyi Aç")}
            >
              {t("Call is active • Open", "Görüşme aktif • Aç")}
            </button>
          )}
        </div>
      </Rnd>
    </div>
  );
}
