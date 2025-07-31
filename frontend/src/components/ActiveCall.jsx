import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { endCall, answerCall } from "../store/callSlice";
import { setActiveChat } from "../store/chatSlice"; // Chat slice'ında varsa
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

export default function ActiveCall({ socket, currentUser }) {
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

      // Aktif sohbeti seçili bırak
      if (chat_id) {
        dispatch(setActiveChat(chat_id));
        navigate(`/chat/${chat_id}`);
      } else if (peerUser?.id) {
        // peerUser'dan chat id'yi bulabiliyorsan kullan!
        navigate(`/chat/${peerUser.id}`);
      }
    };
    socket.on("webrtc_call_end", handleCallEnd);
    return () => socket.off("webrtc_call_end", handleCallEnd);
  }, [socket, dispatch, chat_id, peerUser, navigate]);

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
          });
        } else if (incoming && incoming.sdp) {
          await handleOffer(incoming);
        }

        socket.on("webrtc_offer", handleOffer);

        socket.on("webrtc_answer", async (data) => {
          if (data.from_user_id !== peerUser?.id) return;
          await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
          for (const c of remoteCandidatesBuffer.current) {
            try {
              await pc.addIceCandidate(c);
            } catch {}
          }
          remoteCandidatesBuffer.current = [];
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
        // Yine aktif chate kal
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

  // X tuşu: iki tarafa da call end signal ve cleanup
  const handleEndCall = () => {
    cleanupMedia();
    socket.emit("webrtc_call_end", {
      from_user_id: currentUser.id,
      to_user_id: peerUser?.id,
    });
    dispatch(endCall());
    // Sohbet ekranına yönlendir
    if (chat_id) {
      dispatch(setActiveChat(chat_id));
      navigate(`/chat/${chat_id}`);
    } else if (peerUser?.id) {
      navigate(`/chat/${peerUser.id}`);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: 28,
        zIndex: 20,
        position: "relative",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #23273c 72%, #262d43 100%)",
          borderTopLeftRadius: 7,
          borderTopRightRadius: 7,
          borderBottomLeftRadius: 23,
          borderBottomRightRadius: 23,
          boxShadow: "0 4px 32px #0006",
          padding: "23px 36px 16px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          minWidth: 470,
          minHeight: 128,
          maxWidth: 730,
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
            position: "relative",
          }}
        >
          <div
            style={{
              background: "#161b25",
              borderRadius: 8,
              width: 180,
              height: 132,
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
              width: 180,
              height: 132,
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
                Bağlantı bekleniyor…
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            marginTop: 20,
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
    </div>
  );
}
