import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { endCall } from "../store/callSlice";
import {
  getUserMedia,
  createPeerConnection,
  addLocalTracks,
  bindStreamToVideo,
  closePeerConnection,
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

export default function ActiveCall({ socket, currentUser }) {
  const { peerUser, callType, isStarter } = useSelector((state) => state.call);
  const dispatch = useDispatch();

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === "video");
  const [peerConnected, setPeerConnected] = useState(false);

  useEffect(() => {
    let cleanup = () => {};
    let pc;

    async function start() {
      const localStream = await getUserMedia({
        video: callType === "video",
        audio: true,
      });
      localStreamRef.current = localStream;
      bindStreamToVideo(localVideoRef.current, localStream);

      pc = createPeerConnection({
        onIceCandidate: (candidate) => {
          socket.emit("webrtc_ice_candidate", {
            from_user_id: currentUser.id,
            to_user_id: peerUser.id,
            candidate,
          });
        },
        onTrack: (remoteStream) => {
          setPeerConnected(true);
          bindStreamToVideo(remoteVideoRef.current, remoteStream);
        },
      });
      peerConnectionRef.current = pc;
      addLocalTracks(pc, localStream);

      if (isStarter) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc_offer", {
          from_user_id: currentUser.id,
          to_user_id: peerUser.id,
          sdp: offer.sdp,
          call_type: callType,
        });
      }

      socket.on("webrtc_answer", async (data) => {
        if (data.from_user_id !== peerUser.id) return;
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      });
      socket.on("webrtc_ice_candidate", async (data) => {
        if (data.from_user_id !== peerUser.id) return;
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {}
      });

      cleanup = () => {
        socket.off("webrtc_answer");
        socket.off("webrtc_ice_candidate");
      };
    }
    start();

    return () => {
      cleanup();
      closePeerConnection(peerConnectionRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [socket, currentUser, peerUser, callType, isStarter]);

  // Kamera/mikrofon mute
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
          {/* Remote video */}
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
            }}
          >
            {peerConnected ? (
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
                }}
              />
            ) : (
              <span style={{ color: "#8ea0c6", fontSize: 15 }}>
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
            onClick={() => dispatch(endCall())}
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
