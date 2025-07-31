import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { answerCall, endCall } from "../store/callSlice";
import { setConversations } from "../store/chatSlice"; // EKLE
import { useNavigate } from "react-router-dom";
import api from "../api";

// Dışarıda bırakabilirsin
function findConversationIdByUsers(conversations, id1, id2) {
  if (!Array.isArray(conversations)) return null;
  return conversations.find(
    (c) =>
      (String(c.user.id) === String(id1) &&
        String(c.owner_id) === String(id2)) ||
      (String(c.user.id) === String(id2) && String(c.owner_id) === String(id1))
  )?.conversation_id;
}

export default function CallModal({ socket, currentUser }) {
  const { inCall, incoming } = useSelector((state) => state.call);
  const conversations = useSelector((state) => state.chat.conversations || []);
  const peerUser = incoming?.from_user || {};
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (!incoming || inCall) return null;

  // 1. Önce incoming'den chat_id varsa onu kullan
  let chatId = incoming.chat_id;

  // 2. Yoksa: conversations array’inde bu iki user’ın ortak sohbetini bul
  if (!chatId && conversations.length && peerUser?.id && currentUser?.id) {
    chatId = findConversationIdByUsers(
      conversations,
      currentUser.id,
      peerUser.id
    );
  }

  // 3. Hiçbiri yoksa fallback (peerUser.id), asla undefined olmasın
  if (!chatId) chatId = peerUser.id;

  // Kabul Et → Hem answerCall, hem sohbetlere yönlendir
  const handleAccept = async () => {
    let id = chatId;
    if (!id && peerUser?.id && currentUser?.id) {
      // Eğer chat yoksa başlat
      const res = await api.post("/conversations/start_conversation", {
        receiver_id: peerUser.id,
      });
      id = res.data.conversation_id;
    }
    // State’te yoksa, listeyi fetch et ve güncelle
    const found = Array.isArray(conversations)
      ? conversations.find((c) => String(c.conversation_id) === String(id))
      : null;
    if (!found && id) {
      try {
        const newList = await api.get("/conversations/my");
        dispatch(setConversations(newList.data));
      } catch (e) {
        // hata yakalamak istersen
      }
    }
    dispatch(answerCall());
    navigate(`/chat/${id}`);
  };

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
        border: "none",
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
          onClick={handleAccept}
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
