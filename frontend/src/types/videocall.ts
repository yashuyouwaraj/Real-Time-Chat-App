export type VideoCallStatus = "idle" | "calling" | "ringing" | "connected" | "rejected" | "ended";

export type VideoCall = {
  id: string;
  callerId: number;
  recipientId: number;
  callerName: string;
  recipientName: string;
  status: VideoCallStatus;
  startedAt: string | null;
  endedAt: string | null;
};

export type VideoCallSignal = {
  type: "offer" | "answer" | "ice-candidate";
  from: number;
  to: number;
  data: unknown;
};

export type RawVideoCall = Record<string, any>;

export function mapVideoCall(r: RawVideoCall): VideoCall {
  return {
    id: r.id ?? r.callId ?? "",
    callerId: Number(r.callerId ?? r.caller_id),
    recipientId: Number(r.recipientId ?? r.recipient_id),
    callerName: r.callerName ?? r.caller_name ?? "",
    recipientName: r.recipientName ?? r.recipient_name ?? "",
    status: r.status ?? "idle",
    startedAt: r.startedAt ?? r.started_at ?? null,
    endedAt: r.endedAt ?? r.ended_at ?? null,
  };
}
