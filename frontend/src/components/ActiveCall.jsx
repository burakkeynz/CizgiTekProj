import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { endCall, answerCall } from "../store/callSlice";
import {
  getUserMedia,
  createPeerConnection,
  addLocalTracks,
  bindStreamToVideo,
} from "../utils/webrtc";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiX } from "react-icons/fi";

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
    transition: ".15s",
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
      try {
        ref.current.load();
      } catch {}
    }
  });
}

export default function ActiveCall({ socket, currentUser }) {
  const callState = useSelector((state) => state.call);
  const { peerUser, callType, isStarter, incoming } = callState;
  const dispatch = useDispatch();

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  const remoteCandidatesBuffer = useRef([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === "video");
  const [peerConnected, setPeerConnected] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [pendingOffer, setPendingOffer] = useState(null);

  useEffect(() => {
    if (!isStarter && incoming && incoming.sdp && !answered) {
      let pc = peerConnectionRef.current;
      if (!pc) {
        setPendingOffer(incoming);
        return;
      }
      (async () => {
        try {
          console.log("[CALL][CALLEE] OFFER geldi, remote desc set ediliyor.");
          await pc.setRemoteDescription({ type: "offer", sdp: incoming.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc_answer", {
            from_user_id: currentUser.id,
            to_user_id: peerUser?.id,
            sdp: answer.sdp,
          });
          setAnswered(true);
          dispatch(answerCall());
          console.log("[CALL][CALLEE] Answer gönderildi.");
        } catch (e) {
          console.error("[CALLEE][ERR]", e);
        }
      })();
    }
  }, [isStarter, incoming, answered, currentUser, peerUser, socket, dispatch]);

  useEffect(() => {
    if (pendingOffer && peerConnectionRef.current && !answered) {
      (async () => {
        try {
          console.log("[CALL][CALLEE] Pending offer işleniyor.");
          await peerConnectionRef.current.setRemoteDescription({
            type: "offer",
            sdp: pendingOffer.sdp,
          });
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit("webrtc_answer", {
            from_user_id: currentUser.id,
            to_user_id: peerUser?.id,
            sdp: answer.sdp,
          });
          setAnswered(true);
          dispatch(answerCall());
          setPendingOffer(null);
          console.log("[CALL][CALLEE] Answer gönderildi (pendingOffer).");
        } catch (e) {
          console.error("[CALLEE][ERR][buffer]", e);
        }
      })();
    }
  }, [
    pendingOffer,
    peerConnectionRef.current,
    answered,
    currentUser,
    peerUser,
    socket,
    dispatch,
  ]);

  useEffect(() => {
    let cleanupSocket = () => {};
    let ignore = false;

    (async () => {
      try {
        // 1. Local stream
        const localStream = await getUserMedia({
          video: callType === "video",
          audio: true,
        });
        if (ignore) return;
        localStreamRef.current = localStream;
        bindStreamToVideo(localVideoRef.current, localStream);

        // 2. PeerConnection (getLocalStream parametresiyle)
        const pc = createPeerConnection({
          onIceCandidate: (candidate) => {
            socket.emit("webrtc_ice_candidate", {
              from_user_id: currentUser.id,
              to_user_id: peerUser?.id,
              candidate,
            });
          },
          onTrack: (remoteStream) => {
            // Eğer local stream ile aynıysa bind etmiyo
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

        addLocalTracks(pc, localStream);

        // CALLER: createOffer
        if (isStarter) {
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
          console.log("[CALL][CALLER] Offer gönderildi.");
        }

        // S. events
        socket.on("webrtc_answer", async (data) => {
          if (data.from_user_id !== peerUser?.id) return;
          await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
          for (const c of remoteCandidatesBuffer.current) {
            try {
              await pc.addIceCandidate(c);
            } catch {}
          }
          remoteCandidatesBuffer.current = [];
          console.log(
            "[CALL][CALLER] Answer alındı ve remote desc set edildi."
          );
        });

        socket.on("webrtc_ice_candidate", async (data) => {
          if (data.from_user_id !== peerUser?.id) return;
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(data.candidate);
              console.log("[ICE] Candidate eklendi.");
            } catch {}
          } else {
            remoteCandidatesBuffer.current.push(data.candidate);
            console.log("[ICE] Candidate buffer'a alındı.");
          }
        });

        cleanupSocket = () => {
          socket.off("webrtc_answer");
          socket.off("webrtc_ice_candidate");
        };
      } catch (err) {
        cleanupMedia();
        dispatch(endCall());
      }
    })();

    return () => {
      ignore = true;
      cleanupSocket();
      cleanupMedia();
    };
  }, [socket, currentUser, peerUser, callType, isStarter, incoming, answered]);

  // Peer connected olduğunda remote stream tekrar bind
  useEffect(() => {
    if (peerConnected && remoteStreamRef.current && remoteVideoRef.current) {
      bindStreamToVideo(remoteVideoRef.current, remoteStreamRef.current);
    }
  }, [peerConnected]);

  // Butonlar ve cleanup
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
  const cleanupMedia = () => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    cleanupAll(localVideoRef, remoteVideoRef, localStreamRef);
  };
  const handleEndCall = () => {
    cleanupMedia();
    dispatch(endCall());
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
