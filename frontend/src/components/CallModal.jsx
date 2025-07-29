import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { answerCall, endCall } from "../store/callSlice";

export default function CallModal({ socket, currentUser }) {
  const incoming = useSelector((state) => state.call.incoming);
  const peerUser = incoming?.from_user || {};
  const dispatch = useDispatch();

  if (!incoming) return null;

  return (
    <div
      style={{
        background: "#23293A",
        color: "#fff",
        borderRadius: 18,
        padding: 42,
        boxShadow: "0 8px 40px #0008",
        minWidth: 360,
        minHeight: 180,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 18 }}>
        <b>
          {peerUser?.first_name || peerUser?.username || incoming.from_user_id}
        </b>{" "}
        sizi
        <span style={{ color: "#4285f4", marginLeft: 7 }}>
          {incoming.call_type === "video" ? "görüntülü" : "sesli"}
        </span>{" "}
        arıyor!
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
        <button
          onClick={() => dispatch(answerCall())}
          style={{
            background: "#47c165",
            color: "#fff",
            borderRadius: 9,
            padding: "12px 34px",
            fontWeight: 700,
            fontSize: 18,
            border: "none",
            cursor: "pointer",
          }}
        >
          Kabul Et
        </button>
        <button
          onClick={() => dispatch(endCall())}
          style={{
            background: "#e14a4a",
            color: "#fff",
            borderRadius: 9,
            padding: "12px 34px",
            fontWeight: 700,
            fontSize: 18,
            border: "none",
            cursor: "pointer",
          }}
        >
          Reddet
        </button>
      </div>
    </div>
  );
}
