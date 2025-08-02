import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { endCall, answerCall } from "../store/callSlice";
import { setActiveChat } from "../store/chatSlice";
import {
  getUserMedia,
  createPeerConnection,
  addLocalTracks,
  bindStreamToVideo,
  closePeerConnection,
} from "../utils/webrtc";
import { useNavigate } from "react-router-dom";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiX } from "react-icons/fi";

// UI helper
function iconBtn(bg, color) {
  return {
    background: bg,
    color: color,
    border: "none",
    borderRadius: "50%",
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
    boxShadow: "0 1.5px 10px #0002",
    cursor: "pointer",
    margin: "0 7px",
    outline: "none",
  };
}

function cleanupAll(localVideoRef, remoteVideoRef, localStreamRef) {
  if (localStreamRef.current) {
    localStreamRef.current.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
    localStreamRef.current = null;
  }
  [localVideoRef, remoteVideoRef].forEach((ref) => {
    if (ref.current) {
      ref.current.pause();
      ref.current.srcObject = null;
    }
  });
}

export default function ActiveCall({
  socket,
  currentUser,
  onMinimize,
  minimized,
}) {
  const callState = useSelector((state) => state.call);
  const { peerUser, callType, isStarter, incoming, chat_id } = callState;
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteCandidatesBuffer = useRef([]);
  const cleanupCalledRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === "video");
  const [peerConnected, setPeerConnected] = useState(false);

  // Tek seferlik cleanup fonksiyonu
  function cleanupMedia() {
    if (cleanupCalledRef.current) return;
    cleanupCalledRef.current = true;
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    cleanupAll(localVideoRef, remoteVideoRef, localStreamRef);
  }

  // Karşıdan "call end" gelirse anında cleanup ve slice reset, ardından sohbet ekranı!
  useEffect(() => {
    const handleCallEnd = () => {
      cleanupMedia();
      dispatch(endCall());
      // Aktif sohbeti seçili bırak (mutlaka chat_id ile!)
      if (chat_id) {
        dispatch(setActiveChat(chat_id));
        navigate(`/chat/${chat_id}`);
      }
    };
    socket.on("webrtc_call_end", handleCallEnd);
    return () => socket.off("webrtc_call_end", handleCallEnd);
  }, [socket, dispatch, chat_id, navigate]);

  useEffect(() => {
    let ignore = false;
    let cleanupSocket = () => {};

    (async () => {
      try {
        const localStream = await getUserMedia({
          video: callType === "video",
          audio: true,
        });
        if (ignore) return;
        localStreamRef.current = localStream;
        bindStreamToVideo(localVideoRef.current, localStream);

        const pc = createPeerConnection({
          onIceCandidate: (candidate) => {
            socket.emit("webrtc_ice_candidate", {
              from_user_id: currentUser.id,
              to_user_id: peerUser?.id,
              candidate,
              chat_id,
            });
          },
          onTrack: (remoteStream) => {
            remoteStreamRef.current = remoteStream;
            setPeerConnected(true);
            setTimeout(() => {
              if (remoteVideoRef.current) {
                bindStreamToVideo(remoteVideoRef.current, remoteStream);
              }
            }, 100);
          },
          getLocalStream: () => localStreamRef.current,
        });
        peerConnectionRef.current = pc;

        const handleOffer = async (data) => {
          if (!pc) return;
          try {
            await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
            addLocalTracks(pc, localStreamRef.current);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("webrtc_answer", {
              from_user_id: currentUser.id,
              to_user_id: peerUser?.id,
              sdp: answer.sdp,
              chat_id,
            });
            dispatch(answerCall());
          } catch (e) {
            console.error("[CALLEE][handleOffer][ERROR]", e);
          }
        };

        if (isStarter) {
          addLocalTracks(pc, localStream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc_offer", {
            from_user_id: currentUser.id,
            from_user: { id: currentUser.id, name: currentUser.name },
            to_user_id: peerUser?.id,
            to_user: peerUser,
            sdp: offer.sdp,
            call_type: callType,
            chat_id,
          });
        } else if (incoming && incoming.sdp) {
          await handleOffer(incoming);
        }

        socket.on("webrtc_offer", handleOffer);

        socket.on("webrtc_answer", async (data) => {
          if (data.from_user_id !== peerUser?.id) return;
          // Sadece doğru signaling statede sdp answer işlemek için
          if (!pc || pc.signalingState !== "have-local-offer") {
            console.warn(
              "[CALLER] SDP answer geldi ama signalingState:",
              pc?.signalingState
            );
            return;
          }
          try {
            await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
            for (const c of remoteCandidatesBuffer.current) {
              try {
                await pc.addIceCandidate(c);
              } catch {}
            }
            remoteCandidatesBuffer.current = [];
          } catch (e) {
            console.error("[CALLER][setRemoteDescription][ERROR]", e);
          }
        });

        socket.on("webrtc_ice_candidate", async (data) => {
          if (data.from_user_id !== peerUser?.id) return;
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(data.candidate);
            } catch {}
          } else {
            remoteCandidatesBuffer.current.push(data.candidate);
          }
        });

        cleanupSocket = () => {
          socket.off("webrtc_offer", handleOffer);
          socket.off("webrtc_answer");
          socket.off("webrtc_ice_candidate");
        };
      } catch (err) {
        cleanupMedia();
        dispatch(endCall());
        // Yine aktif chate kalmak için
        if (chat_id) {
          dispatch(setActiveChat(chat_id));
          navigate(`/chat/${chat_id}`);
        } else if (peerUser?.id) {
          navigate(`/chat/${peerUser.id}`);
        }
      }
    })();

    return () => {
      ignore = true;
      cleanupSocket();
      cleanupMedia();
    };
  }, [
    socket,
    currentUser,
    peerUser,
    callType,
    isStarter,
    incoming,
    dispatch,
    chat_id,
    navigate,
  ]);

  useEffect(() => {
    if (peerConnected && remoteStreamRef.current && remoteVideoRef.current) {
      bindStreamToVideo(remoteVideoRef.current, remoteStreamRef.current);
    }
  }, [peerConnected]);

  // Butonlar
  const handleToggleMic = () => {
    setMicOn((prev) => {
      if (localStreamRef.current) {
        localStreamRef.current
          .getAudioTracks()
          .forEach((t) => (t.enabled = !prev));
      }
      return !prev;
    });
  };
  const handleToggleCam = () => {
    setCamOn((prev) => {
      if (localStreamRef.current) {
        localStreamRef.current
          .getVideoTracks()
          .forEach((t) => (t.enabled = !prev));
      }
      return !prev;
    });
  };

  const handleEndCall = () => {
    cleanupMedia();
    socket.emit("webrtc_call_end", {
      from_user_id: currentUser.id,
      to_user_id: peerUser?.id,
      chat_id,
    });
    dispatch(endCall());
    if (chat_id) {
      dispatch(setActiveChat(chat_id));
      navigate(`/chat/${chat_id}`);
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #23273c 84%, #262d43 100%)",
        borderRadius: 22,
        boxShadow: "0 8px 32px #0007",
        border: "1.5px solid #2d3343",
        padding: "26px 34px 18px 34px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: 420,
        minHeight: 145,
        maxWidth: 680,
        gap: 18,
        position: "relative",
        transition: "box-shadow .2s, border .2s",
      }}
    >
      {/* Minimize Button */}
      {typeof onMinimize === "function" && (
        <button
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "#202a3a",
            color: "#eee",
            border: "none",
            borderRadius: "50%",
            width: 28,
            height: 28,
            fontSize: 19,
            fontWeight: 700,
            cursor: "pointer",
            opacity: 0.8,
            zIndex: 20,
            transition: "background .13s",
          }}
          onClick={onMinimize}
          title="Minimize Et"
        >
          &#8211;
        </button>
      )}

      {/* Video Area */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
          position: "relative",
        }}
      >
        <div
          style={{
            background: "#161b25",
            borderRadius: 8,
            width: 168,
            height: 126,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1.5px 6px #0002",
            position: "relative",
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 6,
              objectFit: "cover",
              background: "#22263b",
            }}
          />
        </div>
        <div
          style={{
            background: "#161b25",
            borderRadius: 8,
            width: 168,
            height: 126,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1.5px 6px #0002",
            position: "relative",
          }}
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 6,
              objectFit: "cover",
              background: "#22263b",
              opacity: peerConnected ? 1 : 0,
              transition: "opacity 0.2s",
            }}
          />
          {!peerConnected && (
            <span
              style={{
                color: "#8ea0c6",
                fontSize: 15,
                position: "absolute",
                left: 0,
                right: 0,
                textAlign: "center",
              }}
            >
              Waiting network connection…
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: 18,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 13,
        }}
      >
        <button
          onClick={handleToggleMic}
          title={micOn ? "Mikrofonu Kapat" : "Mikrofonu Aç"}
          style={iconBtn(
            micOn ? "#212539" : "#fff",
            micOn ? "#fff" : "#ff3c5c"
          )}
        >
          {micOn ? <FiMic /> : <FiMicOff />}
        </button>
        {callType === "video" && (
          <button
            onClick={handleToggleCam}
            title={camOn ? "Kamerayı Kapat" : "Kamerayı Aç"}
            style={iconBtn(
              camOn ? "#212539" : "#fff",
              camOn ? "#fff" : "#ff3c5c"
            )}
          >
            {camOn ? <FiVideo /> : <FiVideoOff />}
          </button>
        )}
        <button
          onClick={handleEndCall}
          title="Görüşmeyi Bitir"
          style={iconBtn("#fff", "#ff3c5c")}
        >
          <FiX />
        </button>
      </div>
    </div>
  );
}
