const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export async function getUserMedia(constraints = { video: true, audio: true }) {
  return await navigator.mediaDevices.getUserMedia(constraints);
}

export function createPeerConnection({ onIceCandidate, onTrack }) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) onIceCandidate(event.candidate);
  };
  pc.ontrack = (event) => {
    if (onTrack) onTrack(event.streams[0]);
  };

  return pc;
}

export function addLocalTracks(pc, localStream) {
  if (!pc || !localStream) return;
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });
}

export function bindStreamToVideo(videoEl, stream) {
  if (videoEl && stream) videoEl.srcObject = stream;
}

export function closePeerConnection(pc) {
  if (pc) {
    pc.getSenders().forEach((sender) => {
      if (sender.track) sender.track.stop();
    });
    pc.close();
  }
}
