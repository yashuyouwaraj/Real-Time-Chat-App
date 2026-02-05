"use client";

import { useEffect, useRef, useState } from "react";
import { type Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import gsap from "gsap";

type VideoCallWindowProps = {
  callId: string;
  callerId: number;
  callerName: string;
  recipientId: number;
  recipientName: string;
  socket: Socket | null;
  connected: boolean;
  onCallEnd: () => void;
  isIncoming: boolean;
};

export function VideoCallWindow(props: VideoCallWindowProps) {
  const {
    callId,
    callerId,
    callerName,
    recipientId,
    recipientName,
    socket,
    connected,
    onCallEnd,
    isIncoming,
  } = props;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<
    "connecting" | "ringing" | "connected" | "ended"
  >(isIncoming ? "ringing" : "connecting");
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Initialize local stream
  useEffect(() => {
    let isMounted = true;

    async function initializeLocalStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        initializePeerConnection(stream);
      } catch (err) {
        console.error("Error accessing media devices:", err);
        toast.error("Cannot access camera or microphone");
        onCallEnd();
      }
    }

    initializeLocalStream();

    return () => {
      isMounted = false;
    };
  }, []);

  // Animate container on mount
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }
      );
    }
  }, []);

  // Initialize WebRTC peer connection
  function initializePeerConnection(localStream: MediaStream) {
    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Add local stream tracks
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        if (remoteStreamRef.current) {
          remoteStreamRef.current.addTrack(event.track);
        } else {
          remoteStreamRef.current = new MediaStream([event.track]);
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("video:signal:ice-candidate", {
            to: recipientId,
            callId,
            candidate: event.candidate,
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(
          "Connection state changed:",
          peerConnection.connectionState
        );

        if (peerConnection.connectionState === "failed") {
          toast.error("Connection failed");
          onCallEnd();
        } else if (peerConnection.connectionState === "disconnected") {
          toast.warning("Disconnected from call");
          onCallEnd();
        }
      };

      peerConnectionRef.current = peerConnection;

      if (!isIncoming) {
        createOffer();
      }
    } catch (err) {
      console.error("Error initializing peer connection:", err);
      toast.error("Failed to initialize connection");
      onCallEnd();
    }
  }

  // Create offer for outgoing calls
  async function createOffer() {
    try {
      if (!peerConnectionRef.current) return;

      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnectionRef.current.setLocalDescription(offer);

      socket?.emit("video:signal:offer", {
        to: recipientId,
        callId,
        offer,
      });
    } catch (err) {
      console.error("Error creating offer:", err);
      toast.error("Failed to create offer");
    }
  }

  // Handle incoming offer
  function handleIncomingOffer(offer: RTCSessionDescriptionInit) {
    (async () => {
      try {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket?.emit("video:signal:answer", {
          to: callerId,
          callId,
          answer,
        });
      } catch (err) {
        console.error("Error handling offer:", err);
        toast.error("Failed to handle offer");
      }
    })();
  }

  // Handle incoming answer
  function handleIncomingAnswer(answer: RTCSessionDescriptionInit) {
    (async () => {
      try {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } catch (err) {
        console.error("Error handling answer:", err);
        toast.error("Failed to handle answer");
      }
    })();
  }

  // Handle incoming ICE candidate
  function handleIncomingIceCandidate(candidate: RTCIceCandidateInit) {
    (async () => {
      try {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    })();
  }

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    function handleOffer(payload: {
      from?: number;
      callId?: string;
      offer?: RTCSessionDescriptionInit;
    }) {
      if (payload.callId !== callId || !payload.offer) return;
      handleIncomingOffer(payload.offer);
    }

    function handleAnswer(payload: {
      from?: number;
      callId?: string;
      answer?: RTCSessionDescriptionInit;
    }) {
      if (payload.callId !== callId || !payload.answer) return;
      handleIncomingAnswer(payload.answer);
    }

    function handleIceCandidate(payload: {
      from?: number;
      callId?: string;
      candidate?: RTCIceCandidateInit;
    }) {
      if (payload.callId !== callId || !payload.candidate) return;
      handleIncomingIceCandidate(payload.candidate);
    }

    socket.on("video:signal:offer", handleOffer);
    socket.on("video:signal:answer", handleAnswer);
    socket.on("video:signal:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("video:signal:offer", handleOffer);
      socket.off("video:signal:answer", handleAnswer);
      socket.off("video:signal:ice-candidate", handleIceCandidate);
    };
  }, [socket, callId, callerId, recipientId]);

  // Handle call acceptance
  useEffect(() => {
    if (!socket || callStatus !== "connecting") return;

    function handleCallAccepted(payload: { callId?: string }) {
      if (payload.callId !== callId) return;
      setCallStatus("connected");
      setCallDuration(0);

      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      toast.success("Call connected");
    }

    socket.on("video:call:accepted", handleCallAccepted);

    return () => {
      socket.off("video:call:accepted", handleCallAccepted);
    };
  }, [socket, callId, callStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnectionRef.current?.close();
    };
  }, []);

  function handleAcceptCall() {
    socket?.emit("video:call:accept", {
      callId,
      recipientName,
    });
    setCallStatus("connected");
    setCallDuration(0);

    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    durationIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }

  function handleRejectCall() {
    socket?.emit("video:call:reject", { callId });
    onCallEnd();
  }

  function handleEndCall() {
    socket?.emit("video:call:end", { callId });
    onCallEnd();
  }

  function toggleAudio() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  }

  function toggleVideo() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const otherUserName = callerId === recipientId ? callerName : recipientName;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden rounded-none border-0 bg-linear-to-br from-black via-slate-900 to-black md:fixed md:bottom-4 md:right-4 md:top-auto md:h-96 md:w-96 md:rounded-2xl md:border md:border-white/10 md:shadow-2xl md:shadow-black/50"
    >
      {/* Header with semi-transparent backdrop */}
      <div className="relative border-b border-white/10 bg-linear-to-b from-white/5 to-transparent py-3 px-4 backdrop-blur-sm">
        <div>
          <h3 className="text-sm font-semibold text-white">{otherUserName}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {callStatus === "ringing"
              ? "Ringing..."
              : callStatus === "connecting"
                ? "Connecting..."
                : callStatus === "connected"
                  ? formatDuration(callDuration)
                  : "Call ended"}
          </p>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {/* Remote video (large) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />

        {/* Local video (small, picture-in-picture) with subtle shadow */}
        <div className="absolute bottom-4 right-4 h-24 w-32 overflow-hidden rounded-lg border border-white/20 shadow-lg shadow-black/30 bg-black/30">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* Controls Footer */}
      <div
        ref={controlsRef}
        className="border-t border-white/10 bg-linear-to-t from-black/80 via-black/40 to-transparent p-4 backdrop-blur-sm"
      >
        {callStatus === "ringing" && isIncoming ? (
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleAcceptCall}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-emerald-500/50 hover:from-emerald-400 hover:to-emerald-500 transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <Phone className="w-5 h-5" />
            </button>
            <button
              onClick={handleRejectCall}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-linear-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-red-500/50 hover:from-red-400 hover:to-red-500 transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        ) : callStatus === "connected" ? (
          <div className="flex gap-2 justify-center">
            <button
              onClick={toggleAudio}
              className={`flex items-center justify-center h-10 w-10 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg ${
                isAudioEnabled
                  ? "bg-slate-600 hover:bg-slate-500 text-white hover:shadow-slate-500/30"
                  : "bg-red-600 hover:bg-red-500 text-white hover:shadow-red-500/30"
              }`}
            >
              {isAudioEnabled ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={toggleVideo}
              className={`flex items-center justify-center h-10 w-10 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg ${
                isVideoEnabled
                  ? "bg-slate-600 hover:bg-slate-500 text-white hover:shadow-slate-500/30"
                  : "bg-red-600 hover:bg-red-500 text-white hover:shadow-red-500/30"
              }`}
            >
              {isVideoEnabled ? (
                <Video className="w-4 h-4" />
              ) : (
                <VideoOff className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleEndCall}
              className="flex items-center justify-center h-10 w-10 rounded-full bg-linear-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-red-500/50 hover:from-red-400 hover:to-red-500 transition-all duration-200 transform hover:scale-110 active:scale-95"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleEndCall}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-linear-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-red-500/50 hover:from-red-400 hover:to-red-500 transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

