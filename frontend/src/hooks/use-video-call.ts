"use client";

import { useEffect, useState } from "react";
import { type Socket } from "socket.io-client";

export type ActiveCall = {
  callId: string;
  callerId: number;
  callerName: string;
  recipientId: number;
  recipientName: string;
  isIncoming: boolean;
  status: "connecting" | "ringing" | "connected" | "ended";
};

type UseVideoCallResult = {
  activeCall: ActiveCall | null;
  incomingCall: ActiveCall | null;
  initiateCall: (recipientId: number, recipientName: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
};

export function useVideoCall(
  socket: Socket | null,
  currentUserId: number | null,
  currentUserName: string | null
): UseVideoCallResult {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);

  // Handle incoming call
  useEffect(() => {
    if (!socket) return;

    function handleIncomingCall(payload: {
      callId?: string;
      callerId?: number;
      callerName?: string;
    }) {
      if (!payload.callId || !payload.callerId) return;

      const newCall: ActiveCall = {
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName || "Unknown",
        recipientId: currentUserId || 0,
        recipientName: currentUserName || "You",
        isIncoming: true,
        status: "ringing",
      };

      setIncomingCall(newCall);
    }

    socket.on("video:call:incoming", handleIncomingCall);

    return () => {
      socket.off("video:call:incoming", handleIncomingCall);
    };
  }, [socket, currentUserId, currentUserName]);

  // Handle call ended
  useEffect(() => {
    if (!socket) return;

    function handleCallEnded(payload: { callId?: string }) {
      if (activeCall?.callId === payload.callId) {
        setActiveCall(null);
      }
      if (incomingCall?.callId === payload.callId) {
        setIncomingCall(null);
      }
    }

    socket.on("video:call:ended", handleCallEnded);

    return () => {
      socket.off("video:call:ended", handleCallEnded);
    };
  }, [socket, activeCall, incomingCall]);

  // Handle call rejected
  useEffect(() => {
    if (!socket) return;

    function handleCallRejected(payload: { callId?: string }) {
      if (activeCall?.callId === payload.callId) {
        setActiveCall(null);
      }
    }

    socket.on("video:call:rejected", handleCallRejected);

    return () => {
      socket.off("video:call:rejected", handleCallRejected);
    };
  }, [socket, activeCall]);

  function initiateCall(recipientId: number, recipientName: string) {
    if (!socket || !currentUserId || !currentUserName) return;

    const callId = `call_${Date.now()}_${currentUserId}_${recipientId}`;

    const newCall: ActiveCall = {
      callId,
      callerId: currentUserId,
      callerName: currentUserName,
      recipientId,
      recipientName,
      isIncoming: false,
      status: "connecting",
    };

    setActiveCall(newCall);

    socket.emit("video:call:initiate", {
      recipientUserId: recipientId,
    });
  }

  function acceptCall() {
    if (!incomingCall || !socket) return;

    const acceptedCall: ActiveCall = {
      ...incomingCall,
      status: "connected",
    };

    setActiveCall(acceptedCall);
    setIncomingCall(null);

    socket.emit("video:call:accept", {
      callId: incomingCall.callId,
      recipientName: currentUserName,
    });
  }

  function rejectCall() {
    if (!incomingCall || !socket) return;

    socket.emit("video:call:reject", {
      callId: incomingCall.callId,
    });

    setIncomingCall(null);
  }

  function endCall() {
    if (!activeCall || !socket) return;

    socket.emit("video:call:end", {
      callId: activeCall.callId,
    });

    setActiveCall(null);
  }

  return {
    activeCall,
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
