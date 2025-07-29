import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

// .env'den ya da sabit port
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:8000";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // Gerekirse TURN ekle!
  ],
};

export default function WebRTCVideoCall({ currentUser, peerUser }) {
  const [inCall, setInCall] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [callData, setCallData] = useState(null);

  const localVideo = useRef();
  const remoteVideo = useRef();
  const peerConnection = useRef();
  const socket = useRef();

  // 1. Socket bağlantısı ve event’ler
  useEffect(() => {
    if (!currentUser?.id) return;
    socket.current = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.current.on("connect", () => {
      socket.current.emit("join", { user_id: currentUser.id });
    });

    // Gelen offer (arama alınıyor)
    socket.current.on("webrtc_offer", async (data) => {
      if (data.to_user_id !== currentUser.id) return;
      setIsReceivingCall(true);
      setCallData(data);
    });

    // Gelen answer (karşı taraf aramayı kabul etti)
    socket.current.on("webrtc_answer", async (data) => {
      if (data.to_user_id !== currentUser.id) return;
      await peerConnection.current.setRemoteDescription({
        type: "answer",
        sdp: data.sdp,
      });
    });

    // ICE candidate geldi
    socket.current.on("webrtc_ice_candidate", async (data) => {
      if (data.to_user_id !== currentUser.id) return;
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(data.candidate);
        } catch (err) {
          console.warn("ICE add err:", err);
        }
      }
    });

    // Arama sonlandı
    socket.current.on("webrtc_call_end", (data) => {
      if (data.to_user_id !== currentUser.id) return;
      endCall();
    });

    return () => {
      socket.current.disconnect();
    };
    // eslint-disable-next-line
  }, [currentUser?.id]);

  // 2. Arama başlat
  const startCall = async () => {
    setInCall(true);
    // Local stream al
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.current.srcObject = localStream;

    // PeerConnection kur
    peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

    // Local stream’i peer’e ekle
    localStream.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localStream);
    });

    // Remote stream’i dinle
    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
    };

    // ICE candidate gönder
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit("webrtc_ice_candidate", {
          from_user_id: currentUser.id,
          to_user_id: peerUser.id,
          candidate: event.candidate,
        });
      }
    };

    // SDP offer oluştur ve gönder
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);

    socket.current.emit("webrtc_offer", {
      from_user_id: currentUser.id,
      to_user_id: peerUser.id,
      sdp: offer.sdp,
      call_type: "video",
      conversation_id: 1, // örnek
    });
  };

  // 3. Arama cevapla (gelen aramayı kabul et)
  const answerCall = async () => {
    setInCall(true);
    setIsReceivingCall(false);
    // Local stream al
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.current.srcObject = localStream;

    peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

    // Remote stream’i dinle
    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
    };

    // ICE candidate gönder
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit("webrtc_ice_candidate", {
          from_user_id: currentUser.id,
          to_user_id: peerUser.id,
          candidate: event.candidate,
        });
      }
    };

    // Local stream’i peer’e ekle
    localStream.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localStream);
    });

    // Gelen offer’ı remote olarak set et
    await peerConnection.current.setRemoteDescription({
      type: "offer",
      sdp: callData.sdp,
    });

    // Answer oluştur, local olarak set et, gönder
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    socket.current.emit("webrtc_answer", {
      from_user_id: currentUser.id,
      to_user_id: peerUser.id,
      sdp: answer.sdp,
    });
  };

  // 4. Aramayı sonlandır
  const endCall = () => {
    setInCall(false);
    setIsReceivingCall(false);
    setCallData(null);
    setRemoteStream(null);

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localVideo.current?.srcObject) {
      localVideo.current.srcObject.getTracks().forEach((track) => track.stop());
      localVideo.current.srcObject = null;
    }
    if (remoteVideo.current?.srcObject) {
      remoteVideo.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      remoteVideo.current.srcObject = null;
    }

    // Karşı tarafa call_end gönder
    socket.current.emit("webrtc_call_end", {
      from_user_id: currentUser.id,
      to_user_id: peerUser.id,
    });
  };

  // 5. UI
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <video
          ref={localVideo}
          autoPlay
          playsInline
          muted
          style={{ width: 250, borderRadius: 10, background: "#222" }}
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          style={{ width: 250, borderRadius: 10, background: "#222" }}
        />
      </div>
      {!inCall && !isReceivingCall && (
        <button onClick={startCall} style={{ marginTop: 20 }}>
          {peerUser?.name || "Diğer kullanıcı"}'yı Ara
        </button>
      )}
      {isReceivingCall && (
        <div style={{ marginTop: 20 }}>
          <div>Gelen arama var!</div>
          <button onClick={answerCall}>Cevapla</button>
          <button onClick={endCall} style={{ marginLeft: 10 }}>
            Reddet
          </button>
        </div>
      )}
      {inCall && (
        <button
          onClick={endCall}
          style={{ marginTop: 20, background: "red", color: "white" }}
        >
          Aramayı Bitir
        </button>
      )}
    </div>
  );
}
