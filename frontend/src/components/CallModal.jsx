import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { answerCall, endCall } from "../store/callSlice";

export default function CallModal({ socket, currentUser }) {
  const { inCall, incoming } = useSelector((state) => state.call);
  const peerUser = incoming?.from_user || {};
  const dispatch = useDispatch();

  if (!incoming || inCall) return null;

  // **Global pozisyon**
  return (
    <div
      style={{
        position: "fixed",
        top: 32,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2000,
        background: "#23293A",
        color: "#fff",
        borderRadius: 18,
        boxShadow: "0 8px 32px #0004, 0 2px 8px #2234",
        minWidth: 320,
        maxWidth: "85vw",
        padding: "24px 30px 22px 30px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "none", // <-- border yok
        transition: "all .2s cubic-bezier(.65,0,.35,1)",
        animation: "popIn .28s cubic-bezier(.65,0,.35,1)",
      }}
    >
      <div style={{ fontSize: 21, fontWeight: 600, marginBottom: 17 }}>
        <b>
          {peerUser?.first_name || peerUser?.username || incoming.from_user_id}
        </b>{" "}
        sizi
        <span style={{ color: "#5c93f7", marginLeft: 7 }}>
          {incoming.call_type === "video" ? "görüntülü" : "sesli"}
        </span>{" "}
        arıyor!
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
        <button
          onClick={() => dispatch(answerCall())}
          style={{
            background: "#47c165",
            color: "#fff",
            borderRadius: 10,
            padding: "13px 36px",
            fontWeight: 700,
            fontSize: 17,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 1px 8px #1a432055",
          }}
        >
          Kabul Et
        </button>
        <button
          onClick={() => dispatch(endCall())}
          style={{
            background: "#e14a4a",
            color: "#fff",
            borderRadius: 10,
            padding: "13px 36px",
            fontWeight: 700,
            fontSize: 17,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 1px 8px #431a1a55",
          }}
        >
          Reddet
        </button>
      </div>
      <style>
        {`
          @keyframes popIn {
            0% { transform: translateX(-50%) scale(0.7); opacity: 0; }
            100% { transform: translateX(-50%) scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
