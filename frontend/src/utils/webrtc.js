const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export async function getUserMedia(constraints = { video: true, audio: true }) {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  console.log("[DEBUG][MEDIA] getUserMedia ile stream alındı:", stream);
  return stream;
}

export function createPeerConnection({
  onIceCandidate,
  onTrack,
  getLocalStream,
}) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) onIceCandidate(event.candidate);
  };

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    const localStream = getLocalStream ? getLocalStream() : null;
    console.log(
      "[RTC][ontrack] remoteStream.id:",
      remoteStream?.id,
      "| localStream.id:",
      localStream?.id
    );
    console.log(
      "[RTC][ontrack] remoteStream tracks:",
      remoteStream?.getTracks()
    );
    console.log(
      "[RTC][ontrack] remoteStream videoTracks:",
      remoteStream?.getVideoTracks()
    );

    remoteStream?.getVideoTracks()?.forEach((t, i) => {
      console.log(
        "[RTC][ontrack] remote video track",
        i,
        "enabled:",
        t.enabled,
        "muted:",
        t.muted,
        "readyState:",
        t.readyState
      );
    });

    if (remoteStream && (!localStream || remoteStream.id !== localStream.id)) {
      if (onTrack) onTrack(remoteStream);
    } else {
      console.warn(
        "[RTC][ontrack] remoteStream localStream ile aynı, bind edilmeyecek."
      );
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[DEBUG][RTC] ICE Connection State:", pc.iceConnectionState);
  };
  pc.onconnectionstatechange = () => {
    console.log("[DEBUG][RTC] Peer Connection State:", pc.connectionState);
  };

  return pc;
}

export function addLocalTracks(pc, localStream) {
  if (!pc || !localStream) return;
  localStream.getTracks().forEach((track) => {
    console.log("[DEBUG][MEDIA] Track ekleniyor:", track);
    pc.addTrack(track, localStream);
  });
}

export function bindStreamToVideo(videoElem, stream) {
  if (!videoElem) return;
  videoElem.pause();
  videoElem.srcObject = null;

  const videoTracks = stream?.getVideoTracks();
  console.log(
    "[BIND] bindStreamToVideo: videoTracks:",
    videoTracks,
    "stream id:",
    stream?.id
  );
  if (!videoTracks || videoTracks.length === 0) {
    console.warn("[BIND] Remote streamde video track yok!", stream);
    return;
  }
  videoElem.srcObject = stream;
  videoElem.onloadedmetadata = () => {
    videoElem.play();
    setTimeout(() => {
      console.log(
        "[BIND][AFTER PLAY] video readyState:",
        videoElem.readyState,
        "videoElem.paused:",
        videoElem.paused
      );
    }, 300);
  };
  console.log(
    "[BIND] Stream video elemana bind edildi:",
    videoElem,
    "media",
    stream
  );
}

export function closePeerConnection(pc) {
  if (pc) {
    pc.getSenders().forEach((sender) => {
      if (sender.track) sender.track.stop();
    });
    pc.close();
  }
}
