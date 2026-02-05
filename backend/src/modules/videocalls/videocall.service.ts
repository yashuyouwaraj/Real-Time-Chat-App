import { query } from "../../db/db.js";

export type VideoCallRecord = {
  id: string;
  caller_id: number;
  recipient_id: number;
  caller_name: string;
  recipient_name: string;
  status: "idle" | "calling" | "ringing" | "connected" | "rejected" | "ended";
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
};

export async function createVideoCall(params: {
  callerId: number;
  recipientId: number;
  callerName: string;
  recipientName: string;
}) {
  try {
    const { callerId, recipientId, callerName, recipientName } = params;

    // Validate users are not the same
    if (callerId === recipientId) {
      throw new Error("Cannot call yourself");
    }

    const callId = `call_${Date.now()}_${callerId}_${recipientId}`;

    const result = await query(
      `
        INSERT INTO video_calls (
          id,
          caller_id,
          recipient_id,
          caller_name,
          recipient_name,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `,
      [callId, callerId, recipientId, callerName, recipientName, "calling"]
    );

    return result.rows[0] as VideoCallRecord;
  } catch (err) {
    throw err;
  }
}

export async function updateVideoCallStatus(params: {
  callId: string;
  status: "calling" | "ringing" | "connected" | "rejected" | "ended";
  startedAt?: Date | null;
  endedAt?: Date | null;
}) {
  try {
    const { callId, status, startedAt, endedAt } = params;

    const updates: string[] = ["status = $2"];
    const values: unknown[] = [callId, status];
    let paramCount = 3;

    if (startedAt !== undefined) {
      updates.push(`started_at = $${paramCount}`);
      values.push(startedAt);
      paramCount++;
    }

    if (endedAt !== undefined) {
      updates.push(`ended_at = $${paramCount}`);
      values.push(endedAt);
      paramCount++;
    }

    const result = await query(
      `
        UPDATE video_calls
        SET ${updates.join(", ")}
        WHERE id = $1
        RETURNING *
      `,
      values
    );

    return result.rows[0] as VideoCallRecord;
  } catch (err) {
    throw err;
  }
}

export async function getVideoCall(callId: string) {
  try {
    const result = await query(
      `
        SELECT * FROM video_calls
        WHERE id = $1
      `,
      [callId]
    );

    return result.rows[0] as VideoCallRecord | undefined;
  } catch (err) {
    throw err;
  }
}

export async function endVideoCall(callId: string) {
  try {
    const result = await query(
      `
        UPDATE video_calls
        SET status = 'ended', ended_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [callId]
    );

    return result.rows[0] as VideoCallRecord;
  } catch (err) {
    throw err;
  }
}
