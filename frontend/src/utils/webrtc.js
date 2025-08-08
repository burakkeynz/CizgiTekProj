export const WebRTCMedia = { localStream: null, remoteStream: null };
export function rememberLocalStream(s) {
  WebRTCMedia.localStream = s;
}
export function rememberRemoteStream(s) {
  WebRTCMedia.remoteStream = s;
}

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
  rememberLocalStream(stream); // <<< eklendi
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
    rememberRemoteStream(remoteStream); // <<< eklendi

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

export function pickAudioMime() {
  const cands = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4", // Safari bazen m4a
    "audio/webm",
    "audio/ogg",
  ];
  for (const m of cands) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}
export function extFromMime(m) {
  if (!m) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4")) return "m4a";
  if (m.includes("webm")) return "webm";
  return "webm";
}

export function startStreamRecording(stream) {
  if (!stream) throw new Error("startStreamRecording: stream yok");
  const mime = pickAudioMime();
  const rec = mime
    ? new MediaRecorder(stream, { mimeType: mime })
    : new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);

  let resolveFile, rejectFile;
  const filePromise = new Promise((res, rej) => {
    resolveFile = res;
    rejectFile = rej;
  });

  rec.onstop = () => {
    try {
      const rawType = rec.mimeType || "audio/webm";
      const type = rawType.split(";")[0]; // "audio/webm"
      const blob = new Blob(chunks, { type });
      const file = new File(
        [blob],
        `rec_${new Date().toISOString().replace(/[:.]/g, "-")}.${extFromMime(
          type
        )}`,
        { type }
      );
      resolveFile(file);
    } catch (err) {
      rejectFile(err);
    }
  };

  rec.start(250); // 250ms chunk
  return {
    recorder: rec,
    stop: () => {
      if (rec.state !== "inactive") rec.stop();
    },
    filePromise, // await ile File
  };
}

let _ctx, _bus, _worklet, _dest;

export async function startRealtimePCM(
  localStream,
  remoteStream,
  onPCM,
  {
    targetSampleRate = 16000,
    frameMs = 20,
    workletUrl = "/pcm-worklet.js",
  } = {}
) {
  _ctx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 48000,
  });
  await _ctx.audioWorklet.addModule(workletUrl);

  _bus = _ctx.createGain();
  if (localStream) _ctx.createMediaStreamSource(localStream).connect(_bus);
  if (remoteStream) _ctx.createMediaStreamSource(remoteStream).connect(_bus);

  _worklet = new AudioWorkletNode(_ctx, "pcm-writer", {
    processorOptions: { targetSampleRate, frameMs },
  });
  _worklet.port.onmessage = (e) => {
    const ab = e.data?.pcm; // ArrayBuffer (Int16, 20ms @16k)
    if (ab && onPCM) onPCM(ab);
  };
  _bus.connect(_worklet);

  // aynı miks streamini MediaRecorder’a vereceksek
  _dest = _ctx.createMediaStreamDestination();
  _bus.connect(_dest);
  return _dest.stream; // MediaRecorder ile kayıt için
}

export async function startRealtimePCMFromStore(onPCM, opts) {
  return startRealtimePCM(
    WebRTCMedia.localStream,
    WebRTCMedia.remoteStream,
    onPCM,
    opts
  );
}

export function stopRealtimePCM() {
  try {
    _worklet?.port?.close();
  } catch {}
  try {
    _worklet?.disconnect();
  } catch {}
  try {
    _bus?.disconnect();
  } catch {}
  try {
    _ctx?.close();
  } catch {}
  _ctx = _bus = _worklet = _dest = null;
}
