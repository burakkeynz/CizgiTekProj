const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

let lastRemoteStreamId = null;

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
    if (
      remoteStream &&
      (!localStream || remoteStream.id !== localStream.id) &&
      remoteStream.id !== lastRemoteStreamId
    ) {
      lastRemoteStreamId = remoteStream.id;
      onTrack && onTrack(remoteStream);
    }
  };

  return pc;
}

export function addLocalTracks(pc, localStream) {
  if (!pc || !localStream) return;
  const alreadyAddedTracks = pc.getSenders().map((s) => s.track);
  localStream.getTracks().forEach((track) => {
    if (!alreadyAddedTracks.includes(track)) {
      pc.addTrack(track, localStream);
    }
  });
}

export function bindStreamToVideo(videoElem, stream) {
  if (!videoElem || !stream) return;
  videoElem.srcObject = stream;
  videoElem.onloadedmetadata = () => videoElem.play();
}

export function closePeerConnection(pc) {
  if (pc) {
    pc.getSenders().forEach((sender) => {
      if (sender.track) sender.track.stop();
    });
    pc.close();
  }
}
