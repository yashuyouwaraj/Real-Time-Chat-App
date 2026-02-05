import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getUserFromClerk } from "../modules/users/user.service.js";
import { createDirectMessage } from "../modules/chat/chat.service.js";
import {
  createVideoCall,
  updateVideoCallStatus,
  endVideoCall,
} from "../modules/videocalls/videocall.service.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient, isRedisEnabled } from "../config/redis.js";

let io: Server | null = null;

const onlineUsers = new Map<number, Set<string>>();

function addOnlineUser(rawUserId: unknown, socketId: string) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0) return;

  const existing = onlineUsers.get(userId);

  if (existing) {
    existing.add(socketId);
  } else {
    onlineUsers.set(userId, new Set([socketId]));
  }
}

function removeOnlineUser(rawUserId: unknown, socketId: string) {
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId) || userId <= 0) return;

  const existing = onlineUsers.get(userId);

  if (!existing) return;

  existing.delete(socketId);

  if (existing.size === 0) {
    onlineUsers.delete(userId);
  }
}

function getOnlineUserIds(): number[] {
  return Array.from(onlineUsers.keys());
}

function broadcastPresence() {
  io?.emit("presence:update", {
    onlineUserIds: getOnlineUserIds(),
  });
}

export async function initIo(httpServer: HttpServer) {
  if (io) return io; //safeguard -> only create once;

  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:4000",
      credentials: true,
    },
  });
  // Setup Redis adapter for distributed socket.io
  if (isRedisEnabled()) {
    try {
      const redisClient = getRedisClient();
      if (redisClient) {
        // duplicate returns a new client which must be connected
        const sub = redisClient.duplicate();
        await sub.connect();
        io.adapter(createAdapter(redisClient, sub));
        console.log("[Socket.io] Redis adapter enabled for horizontal scaling");
      }
    } catch (err) {
      console.error("[Socket.io Redis Adapter Error]", err);
      console.log("[Socket.io] Falling back to in-memory adapter");
    }
  } else {
    console.log("[Socket.io] Using in-memory adapter");
  }

  io.on("connection", async (socket) => {
    console.log(`[io connection]------> ${socket.id}`);

    try {
      const clerkUserId = socket.handshake.auth?.userId;

      if (!clerkUserId || typeof clerkUserId !== "string") {
        console.log(`[Missing clerk user id]------> ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      const profile = await getUserFromClerk(clerkUserId);
      const rawLocalUserId = profile.user.id;
      const localUserId = Number(rawLocalUserId);
      const displayName = profile.user.displayName ?? null;
      const handle = profile.user.handle ?? null;

      if (!Number.isFinite(localUserId) || localUserId <= 0) {
        console.log(`[Invalid user id]------> ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      (socket.data as {
        userId: number;
        displayName: string | null;
        handle: string | null;
      }) = {
        userId: localUserId,
        displayName,
        handle,
      };

      //  Join noti room

      const notiRoom = `notifications:user:${localUserId}`;
      socket.join(notiRoom);

      // join DM room (create room)
      const dmRoom = `dm:user:${localUserId}`;
      socket.join(dmRoom);

      socket.on("dm:send", async (payload: unknown) => {
        try {
          const data = payload as {
            recipientUserId?: number;
            body?: string;
            imageUrl?: string;
          };

          const senderUserId = (socket.data as { userId?: number }).userId;
          if (!senderUserId) return;

          const recipientUserId = Number(data?.recipientUserId);
          if (!Number.isFinite(recipientUserId) || recipientUserId <= 0) {
            return;
          }

          //NO self DM
          if (senderUserId === recipientUserId) {
            return;
          }

          console.log(`dm:send`, senderUserId, recipientUserId);

          const message = await createDirectMessage({
            senderUserId,
            recipientUserId,
            body: data?.body ?? "",
            imageUrl: data?.imageUrl ?? null,
          });

          const senderRoom = `dm:user:${senderUserId}`;
          const recipientRoom = `dm:user:${recipientUserId}`;

          io?.to(senderRoom).to(recipientRoom).emit("dm:message", message);
        } catch (err) {
          console.error(err);
        }
      });

      socket.on("dm:typing", (payload: unknown) => {
        const data = payload as {
          recipientUserId?: number;
          isTyping?: boolean;
        };

        const senderUserId = (socket.data as { userId?: number }).userId;
        if (!senderUserId) return;

        const recipientUserId = Number(data?.recipientUserId);
        if (!Number.isFinite(recipientUserId) || recipientUserId <= 0) {
          return;
        }

        const recipientRoom = `dm:user:${recipientUserId}`;

        io?.to(recipientRoom).emit("dm:typing", {
          senderUserId,
          recipientRoom,
          isTyping: !!data?.isTyping,
        });
      });

      // Video call events
      socket.on("video:call:initiate", async (payload: unknown) => {
        try {
          const data = payload as {
            recipientUserId?: number;
          };

          const callerId = (socket.data as { userId?: number }).userId;
          const callerName = (socket.data as { displayName?: string | null })
            .displayName;
          if (!callerId) return;

          const recipientId = Number(data?.recipientUserId);
          if (!Number.isFinite(recipientId) || recipientId <= 0) {
            return;
          }

          // No self calls
          if (callerId === recipientId) {
            return;
          }

          console.log(
            `[video:call:initiate] ${callerId} -> ${recipientId}`
          );

          // Create video call record
          const videoCall = await createVideoCall({
            callerId,
            recipientId,
            callerName: callerName || "User",
            recipientName: "", // Will be filled when recipient accepts
          });

          const recipientRoom = `dm:user:${recipientId}`;

          // Send call invitation to recipient
          io?.to(recipientRoom).emit("video:call:incoming", {
            callId: videoCall.id,
            callerId,
            callerName: videoCall.caller_name,
            status: "ringing",
          });
        } catch (err) {
          console.error("[video:call:initiate error]", err);
        }
      });

      socket.on("video:call:accept", async (payload: unknown) => {
        try {
          const data = payload as {
            callId?: string;
            recipientName?: string;
          };

          const recipientId = (socket.data as { userId?: number }).userId;
          if (!recipientId) return;

          const callId = String(data?.callId || "");
          if (!callId) return;

          console.log(`[video:call:accept] ${callId} by ${recipientId}`);

          // Update call status to connected
          await updateVideoCallStatus({
            callId,
            status: "connected",
            startedAt: new Date(),
          });

          // Notify both users
          io?.emit("video:call:accepted", {
            callId,
            recipientId,
            recipientName: data?.recipientName || "User",
            status: "connected",
          });
        } catch (err) {
          console.error("[video:call:accept error]", err);
        }
      });

      socket.on("video:call:reject", async (payload: unknown) => {
        try {
          const data = payload as {
            callId?: string;
          };

          const userId = (socket.data as { userId?: number }).userId;
          if (!userId) return;

          const callId = String(data?.callId || "");
          if (!callId) return;

          console.log(`[video:call:reject] ${callId} by ${userId}`);

          // Update call status to rejected
          await updateVideoCallStatus({
            callId,
            status: "rejected",
            endedAt: new Date(),
          });

          // Notify caller
          io?.emit("video:call:rejected", {
            callId,
            status: "rejected",
          });
        } catch (err) {
          console.error("[video:call:reject error]", err);
        }
      });

      socket.on("video:call:end", async (payload: unknown) => {
        try {
          const data = payload as {
            callId?: string;
          };

          const callId = String(data?.callId || "");
          if (!callId) return;

          console.log(`[video:call:end] ${callId}`);

          // End the call
          await endVideoCall(callId);

          // Notify both users
          io?.emit("video:call:ended", {
            callId,
            status: "ended",
          });
        } catch (err) {
          console.error("[video:call:end error]", err);
        }
      });

      // WebRTC signaling
      socket.on("video:signal:offer", (payload: unknown) => {
        try {
          const data = payload as {
            to?: number;
            callId?: string;
            offer?: unknown;
          };

          const from = (socket.data as { userId?: number }).userId;
          if (!from) return;

          const to = Number(data?.to);
          if (!Number.isFinite(to) || to <= 0) return;

          const toRoom = `dm:user:${to}`;

          io?.to(toRoom).emit("video:signal:offer", {
            from,
            callId: data?.callId,
            offer: data?.offer,
          });
        } catch (err) {
          console.error("[video:signal:offer error]", err);
        }
      });

      socket.on("video:signal:answer", (payload: unknown) => {
        try {
          const data = payload as {
            to?: number;
            callId?: string;
            answer?: unknown;
          };

          const from = (socket.data as { userId?: number }).userId;
          if (!from) return;

          const to = Number(data?.to);
          if (!Number.isFinite(to) || to <= 0) return;

          const toRoom = `dm:user:${to}`;

          io?.to(toRoom).emit("video:signal:answer", {
            from,
            callId: data?.callId,
            answer: data?.answer,
          });
        } catch (err) {
          console.error("[video:signal:answer error]", err);
        }
      });

      socket.on("video:signal:ice-candidate", (payload: unknown) => {
        try {
          const data = payload as {
            to?: number;
            callId?: string;
            candidate?: unknown;
          };

          const from = (socket.data as { userId?: number }).userId;
          if (!from) return;

          const to = Number(data?.to);
          if (!Number.isFinite(to) || to <= 0) return;

          const toRoom = `dm:user:${to}`;

          io?.to(toRoom).emit("video:signal:ice-candidate", {
            from,
            callId: data?.callId,
            candidate: data?.candidate,
          });
        } catch (err) {
          console.error("[video:signal:ice-candidate error]", err);
        }
      });

      // Handle disconnect to clean up online user state
      socket.on("disconnect", () => {
        const userId = (socket.data as { userId?: number }).userId;
        if (userId) {
          removeOnlineUser(userId, socket.id);
          broadcastPresence();
        }
      });

      addOnlineUser(localUserId, socket.id);
      broadcastPresence();
    } catch (err) {
      console.log(`[Error while socket connection]------> ${err}`);
      socket.disconnect(true);
    }
  });
}

export function getIo() {
  return io;
}
