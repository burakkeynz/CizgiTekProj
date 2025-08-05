import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { answerCall, endCall } from "../store/callSlice";
import { setConversations } from "../store/chatSlice";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useLanguage } from "./LanguageContext";

// Kullanıcılar arasında mevcut sohbet id
function findConversationIdByUsers(conversations, id1, id2) {
  if (!Array.isArray(conversations)) return null;
  return conversations.find(
    (c) =>
      (String(c.user.id) === String(id1) &&
        String(c.owner_id) === String(id2)) ||
      (String(c.user.id) === String(id2) && String(c.owner_id) === String(id1))
  )?.conversation_id;
}

export default function CallModal({ socket, currentUser, setUser }) {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const { inCall, incoming } = useSelector((state) => state.call);
  const conversations = useSelector((state) => state.chat.conversations || []);
  const peerUser = incoming?.from_user || {};
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (!incoming || inCall) return null;

  let chatId = incoming.chat_id;

  if (!chatId && conversations.length && peerUser?.id && currentUser?.id) {
    chatId = findConversationIdByUsers(
      conversations,
      currentUser.id,
      peerUser.id
    );
  }

  const handleAccept = async () => {
    let id = chatId;
    if (!id && peerUser?.id && currentUser?.id) {
      try {
        const listRes = await api.get("/conversations/my");
        const match = (listRes.data || []).find(
          (c) =>
            (String(c.user.id) === String(currentUser.id) &&
              String(c.owner_id) === String(peerUser.id)) ||
            (String(c.user.id) === String(peerUser.id) &&
              String(c.owner_id) === String(currentUser.id))
        );
        if (match) {
          id = match.conversation_id;
        } else {
          const res = await api.post(
            "/conversations/start_conversation",
            null,
            { params: { receiver_id: peerUser.id } }
          );
          id = res.data.conversation_id;
        }
        dispatch(setConversations(listRes.data));
      } catch (e) {
        alert(t("Something went wrong.", "Bir şeyler yanlış gitti."));
        return;
      }
    }

    if (!id) {
      alert(t("Couldn't find chat id.", "Sohbet kimliği bulunamadı."));
      return;
    }

    setUser?.((prev) => ({ ...prev, status: "in_call" }));
    socket.emit("user_status", { user_id: currentUser.id, status: "in_call" });
    try {
      await api.put("/users/update-status", { status: "in_call" });
    } catch (err) {}

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
        {t("sends you a", "sana bir")}{" "}
        <span style={{ color: "#5c93f7", marginLeft: 7 }}>
          {incoming.call_type === "video"
            ? t("video", "görüntülü")
            : t("audio", "sesli")}
        </span>{" "}
        {t("call!", "arama gönderiyor!")}
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
          {t("Accept", "Kabul Et")}
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
          {t("Reject", "Reddet")}
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
