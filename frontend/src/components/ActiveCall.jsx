import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { endCall, answerCall } from "../store/callSlice";
import { setActiveChat } from "../store/chatSlice";
import {
  getUserMedia,
  createPeerConnection,
  addLocalTracks,
  bindStreamToVideo,
} from "../utils/webrtc";
import { useLanguage } from "./LanguageContext";
import { useNavigate } from "react-router-dom";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiX } from "react-icons/fi";
import api from "../api";

const publicUser = (u = {}) => {
  const emailLocal = typeof u.email === "string" ? u.email.split("@")[0] : null;
  return {
    id: u.id ?? null,
    first_name: u.first_name ?? null,
    username: u.username ?? null,
    name:
      u.name ??
      u.display_name ??
      u.full_name ??
      emailLocal ??
      (u.id ? String(u.id) : null),
    profile_picture_url:
      u.profile_picture_url ?? u.avatar_url ?? u.avatar ?? u.photo_url ?? null,
  };
};

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

const nameOf = (u) => {
  if (!u) return "?";
  const emailLocal = typeof u.email === "string" ? u.email.split("@")[0] : null;
  const cand =
    u.first_name ||
    u.name ||
    u.display_name ||
    u.full_name ||
    u.username ||
    emailLocal ||
    (u.id ? String(u.id) : "");
  const s = (cand || "").toString().trim();
  return s || "?";
};

function AvatarBubble({ user, size = 116 }) {
  const name = nameOf(user);
  const letter = name?.[0]?.toUpperCase() || "?";
  const url = user?.profile_picture_url;

  const ring = "#2f3a55";
  const bg = "#0f1625";
  const letterColor = "#cfe0ff";

  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `3px solid ${ring}`,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 12px rgba(0,0,0,.35)",
        overflow: "hidden",
      }}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            color: letterColor,
            fontWeight: 800,
            fontSize: size * 0.44,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {letter}
        </span>
      )}
    </div>
  );
}

function cleanupAll(
  localVideoRef,
  remoteVideoRef,
  localStreamRef,
  remoteAudioRef
) {
  if (localStreamRef.current) {
    localStreamRef.current.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    localStreamRef.current = null;
  }
  [localVideoRef, remoteVideoRef].forEach((r) => {
    if (r?.current) {
      try {
        r.current.pause?.();
      } catch {}
      r.current.srcObject = null;
    }
  });
  if (remoteAudioRef?.current) {
    try {
      remoteAudioRef.current.pause?.();
    } catch {}
    remoteAudioRef.current.srcObject = null;
  }
}

export default function ActiveCall({
  socket,
  currentUser,
  setUser,
  onMinimize,
  minimized,
}) {
  const { language } = useLanguage();
  const t = (en, tr) => (language === "tr" ? tr : en);

  const { peerUser, callType, isStarter, incoming, chat_id } = useSelector(
    (s) => s.call
  );
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteCandidatesBuffer = useRef([]);
  const cleanupCalledRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === "video");
  const [peerConnected, setPeerConnected] = useState(false);

  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const workletSrcRef = useRef(null);
  const pcmSinkRef = useRef(null);
  const pcmStartedRef = useRef(false);
  const callIdRef = useRef(null);

  const dbg = useRef({
    tOfferSent: 0,
    tAnswerRecv: 0,
    tRemoteTrack: 0,
    pcmFrames: 0,
    partials: 0,
  });

  useEffect(() => {
    setUser?.((prev) => ({ ...prev, status: "in_call" }));
    socket.emit("user_status", { user_id: currentUser.id, status: "in_call" });
    api.put("/users/update-status", { status: "in_call" }).catch(() => {});
    return () => {
      setUser?.((prev) => ({ ...prev, status: "online" }));
      socket.emit("user_status", { user_id: currentUser.id, status: "online" });
      api.put("/users/update-status", { status: "online" }).catch(() => {});
    };
  }, []);

  async function startPCMStreaming(stream) {
    if (pcmStartedRef.current) {
      console.log("[PCM] already started — guard hit");
      return;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
      });
      await ctx.resume();
      audioCtxRef.current = ctx;

      await ctx.audioWorklet.addModule("/pcm-worklet.js");

      const node = new AudioWorkletNode(ctx, "pcm-writer", {
        processorOptions: { targetSampleRate: 16000, frameMs: 20 },
        numberOfInputs: 1,
        numberOfOutputs: 1,
      });
      workletNodeRef.current = node;

      node.port.onmessage = (e) => {
        const ab = e?.data?.pcm; // ArrayBuffer (Int16LE, 20ms@16k)
        if (ab) {
          socket.emit("pcm_chunk", { pcm: ab });
          dbg.current.pcmFrames++;
          if (dbg.current.pcmFrames % 50 === 0) {
            console.log(
              `[PCM] frames=${dbg.current.pcmFrames} (20ms@16k) ~ ${
                (dbg.current.pcmFrames * 20) / 1000
              }s`
            );
          }
        }
      };

      const src = ctx.createMediaStreamSource(stream);
      src.connect(node);
      workletSrcRef.current = src;

      const sink = ctx.createGain();
      sink.gain.value = 0;
      node.connect(sink);
      sink.connect(ctx.destination);
      pcmSinkRef.current = sink;

      socket.emit("pcm_begin", {
        user_id: currentUser.id,
        peer_user_id: peerUser?.id,
        session_time_stamp: new Date().toISOString(),
        call_id: callIdRef.current,
        role: isStarter ? "caller" : "callee",
      });

      pcmStartedRef.current = true;
      console.log("[PCM] started");
    } catch (err) {
      console.warn("[PCM] start error:", err);
    }
  }

  function stopPCMStreaming() {
    try {
      socket.emit("pcm_end");
    } catch {}
    try {
      workletSrcRef.current && workletSrcRef.current.disconnect();
    } catch {}
    workletSrcRef.current = null;

    try {
      workletNodeRef.current && workletNodeRef.current.disconnect();
    } catch {}
    try {
      workletNodeRef.current && workletNodeRef.current.port.close?.();
    } catch {}
    workletNodeRef.current = null;

    try {
      pcmSinkRef.current && pcmSinkRef.current.disconnect();
    } catch {}
    pcmSinkRef.current = null;

    try {
      audioCtxRef.current && audioCtxRef.current.close();
    } catch {}
    audioCtxRef.current = null;

    pcmStartedRef.current = false;
    console.log("[PCM] stopped");
  }

  function cleanupMedia() {
    if (cleanupCalledRef.current) return;
    cleanupCalledRef.current = true;

    stopPCMStreaming();

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    cleanupAll(localVideoRef, remoteVideoRef, localStreamRef, remoteAudioRef);
  }

  useEffect(() => {
    if (!callIdRef.current) {
      callIdRef.current =
        (incoming && incoming.call_id) ||
        `${chat_id || "p2p"}-${Date.now()}-${currentUser?.id}-${
          peerUser?.id || ""
        }`;
    }
  }, [incoming?.call_id, chat_id, currentUser?.id, peerUser?.id]);

  // karşı taraf kapattığında
  useEffect(() => {
    const handleCallEnd = () => {
      cleanupMedia();
      dispatch(endCall());
      if (chat_id) {
        dispatch(setActiveChat(chat_id));
        navigate(`/chat/${chat_id}`);
      }
      setUser?.((prev) => ({ ...prev, status: "online" }));
      socket.emit("user_status", { user_id: currentUser.id, status: "online" });
      api.put("/users/update-status", { status: "online" }).catch(() => {});
    };
    socket.on("webrtc_call_end", handleCallEnd);
    return () => socket.off("webrtc_call_end", handleCallEnd);
  }, [socket, dispatch, chat_id, navigate, setUser, currentUser.id]);

  useEffect(() => {
    const onPartial = (p) => {
      dbg.current.partials++;
      console.log(
        `[TRANSCRIPT] #${dbg.current.partials} final=${!!p.is_final}:`,
        p.text
      );
    };
    const onError = (e) => console.warn("[TRANSCRIBE_ERROR]", e);
    socket.on("partial_transcript", onPartial);
    socket.on("transcribe_error", onError);
    return () => {
      socket.off("partial_transcript", onPartial);
      socket.off("transcribe_error", onError);
    };
  }, [socket]);

  // WebRTC setup
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

        // (PCM) — getUserMedia alındıktan hemen sonra başlat
        await startPCMStreaming(localStreamRef.current);

        if (callType === "video" && localVideoRef.current) {
          bindStreamToVideo(localVideoRef.current, localStream);
        }

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
            dbg.current.tRemoteTrack = performance.now();
            console.log(
              "[RTC] remote track received. Δ from offer=",
              (dbg.current.tRemoteTrack - dbg.current.tOfferSent).toFixed(0),
              "ms; from answer=",
              (dbg.current.tRemoteTrack - dbg.current.tAnswerRecv).toFixed(0),
              "ms"
            );
            setTimeout(() => {
              if (callType === "video" && remoteVideoRef.current) {
                bindStreamToVideo(remoteVideoRef.current, remoteStream);
              }
              if (callType === "audio" && remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.play?.();
              }
            }, 80);
          },
          getLocalStream: () => localStreamRef.current,
        });
        peerConnectionRef.current = pc;

        const handleOffer = async (data) => {
          if (!peerConnectionRef.current) return;
          const pc = peerConnectionRef.current;

          try {
            if (!callIdRef.current && data.call_id) {
              callIdRef.current = data.call_id;
            }

            await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });

            addLocalTracks(pc, localStreamRef.current);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("webrtc_answer", {
              from_user_id: currentUser.id,
              to_user_id: peerUser?.id,
              sdp: answer.sdp,
              chat_id,
              call_id: callIdRef.current,
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
          dbg.current.tOfferSent = performance.now();

          socket.emit("webrtc_offer", {
            from_user_id: currentUser.id,
            to_user_id: peerUser?.id,
            from_user: publicUser(currentUser),
            to_user: publicUser(peerUser),
            sdp: offer.sdp,
            call_type: callType,
            chat_id,
            call_id: callIdRef.current, //şimdi ekledim
          });
          console.log("[RTC] offer sent");
        } else if (incoming && incoming.sdp) {
          await handleOffer(incoming);
        }

        socket.on("webrtc_offer", handleOffer);

        socket.on("webrtc_answer", async (data) => {
          if (data.from_user_id !== peerUser?.id) return;
          if (!pc || pc.signalingState !== "have-local-offer") return;
          try {
            await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
            dbg.current.tAnswerRecv = performance.now();
            console.log(
              "[RTC] answer received. Δ from offer=",
              (dbg.current.tAnswerRecv - dbg.current.tOfferSent).toFixed(0),
              "ms"
            );
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
      } catch (e) {
        console.error(e);
        cleanupMedia();
        dispatch(endCall());
        if (chat_id) {
          dispatch(setActiveChat(chat_id));
          navigate(`/chat/${chat_id}`);
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

  // UI bind tekrar (peer bağlandıysa)
  useEffect(() => {
    if (!peerConnected) return;
    if (
      callType === "video" &&
      remoteStreamRef.current &&
      remoteVideoRef.current
    ) {
      bindStreamToVideo(remoteVideoRef.current, remoteStreamRef.current);
    } else if (
      callType === "audio" &&
      remoteStreamRef.current &&
      remoteAudioRef.current
    ) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.play?.();
    }
  }, [peerConnected, callType]);

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
    setUser?.((prev) => ({ ...prev, status: "online" }));
    socket.emit("user_status", { user_id: currentUser.id, status: "online" });
    api.put("/users/update-status", { status: "online" }).catch(() => {});
    if (chat_id) {
      dispatch(setActiveChat(chat_id));
      navigate(`/chat/${chat_id}`);
    }
  };

  const panelBg = "linear-gradient(135deg, #23273c 84%, #262d43 100%)";
  const panelBorder = "#2d3343";

  return (
    <div
      style={{
        background: panelBg,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        boxShadow: "0 8px 32px #0007",
        border: `1.5px solid ${panelBorder}`,
        borderBottom: "2px solid #3a4153",
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
            opacity: 0.9,
            zIndex: 20,
            transition: "background .13s",
          }}
          onClick={onMinimize}
          title={t("Minimize", "Minimize et ")}
        >
          &#8211;
        </button>
      )}

      {/* MEDIA */}
      {callType === "video" ? (
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
              boxShadow: "0 1.5px 6px rgba(0,0,0,.2)",
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
              boxShadow: "0 1.5px 6px rgba(0,0,0,.2)",
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
                {t("waiting_connection", "Ağ bağlantısı bekleniyor…")}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 42,
          }}
        >
          <AvatarBubble user={publicUser(currentUser)} size={110} />
          <AvatarBubble user={publicUser(peerUser)} size={110} />
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* KONTROLLER */}
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
          title={
            micOn
              ? t("Turn off the mic ", "Mikrofonu Kapat")
              : t("Turn on the mic", "Mikrofonu Aç")
          }
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
            title={
              camOn
                ? t("Turn off the cam", "Kamerayı Kapat")
                : t("Turn on the cam", "Kamerayı Aç")
            }
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
          title={t("End call", "Görüşmeyi Bitir")}
          style={iconBtn("#fff", "#ff3c5c")}
        >
          <FiX />
        </button>
      </div>
    </div>
  );
}
