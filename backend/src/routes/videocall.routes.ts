import { getAuth } from "@clerk/express";
import { Router } from "express";
import { getVideoCall } from "../modules/videocalls/videocall.service.js";

export const videoCallRouter = Router();

videoCallRouter.get("/call/:callId", async (req, res, next) => {
  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const callId = req.params.callId;

    if (!callId) {
      return res.status(400).json({ error: "Call ID is required" });
    }

    const videoCall = await getVideoCall(callId);

    if (!videoCall) {
      return res.status(404).json({ error: "Call not found" });
    }

    res.json({
      data: {
        id: videoCall.id,
        callerId: videoCall.caller_id,
        recipientId: videoCall.recipient_id,
        callerName: videoCall.caller_name,
        recipientName: videoCall.recipient_name,
        status: videoCall.status,
        startedAt: videoCall.started_at?.toISOString() || null,
        endedAt: videoCall.ended_at?.toISOString() || null,
      },
    });
  } catch (err) {
    next(err);
  }
});
