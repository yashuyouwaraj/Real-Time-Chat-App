"use client";

import DirectChatPanel from "@/components/chat/direct-chat-panel";
import { VideoCallWindow } from "@/components/chat/video-call-window";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSocket } from "@/hooks/use-socket";
import { useVideoCall } from "@/hooks/use-video-call";
import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ChatUser } from "@/types/chat";
import { useAuth } from "@clerk/nextjs";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import { MessageSquare, Users, Phone, Bell } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import gsap from "gsap";
import { useBrowserNotification } from "@/hooks/use-browser-notification";
import { Button } from "@/components/ui/button";

function chat() {
  const { getToken, userId } = useAuth();
  const { connected, socket } = useSocket();
  const { permission, requestPermission } = useBrowserNotification();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserDbId, setCurrentUserDbId] = useState<number | null>(null);

  const incomingCallModalRef = useRef<HTMLDivElement>(null);

  // Get current user info from /api/me
  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const res = await apiGet<{
          id: number;
          displayName: string | null;
          handle: string | null;
        }>(apiClient, "/api/me");

        if (!isMounted) return;

        if (res.displayName) {
          setCurrentUserName(res.displayName);
        } else if (res.handle) {
          setCurrentUserName(res.handle);
        }

        setCurrentUserDbId(res.id);
      } catch (err) {
        console.error("Failed to load current user:", err);
      }
    }

    if (userId) {
      loadCurrentUser();
    }

    return () => {
      isMounted = false;
    };
  }, [userId, apiClient]);

  const videoCall = useVideoCall(socket, currentUserDbId, currentUserName);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoadingUsers(true);

      try {
        const res = await apiGet<ChatUser[]>(apiClient, "/api/chat/users");

        if (!isMounted) return;
        const finalRes = res.map((row) => ({
          id: Number(row.id),
          displayName: row.displayName ?? null,
          handle: row.handle ?? null,
          avatarUrl: row.avatarUrl ?? null,
        }));
        setUsers(finalRes);

        if (res.length > 0 && activeUserId === null) {
          setActiveUserId(res[0].id);
        }
      } catch (err) {
        console.log(err);
      } finally {
        setLoadingUsers(false);
      }
    }
    load();

    return () => {
      isMounted = false;
    };
  }, [getToken]);

  useEffect(() => {
    if (!socket) return;

    function handlePresense(payload: { onlineUserIds?: number[] }) {
      const list = payload?.onlineUserIds ?? [];
      setOnlineUserIds(list);
    }

    socket.on("presence:update", handlePresense);

    return () => {
      socket.off("presence:update", handlePresense);
    };
  }, [socket]);

  const activeUser =
    activeUserId !== null
      ? (users.find((u) => u.id === activeUserId) ?? null)
      : null;

  const onlineCount = users.filter((u) => onlineUserIds.includes(u.id)).length;

  return (
    <div className="mx-auto max-w-6xl flex w-full flex-col gap-4 py-6 md:flex-row md:gap-6">
      <aside className="w-full shrink-0 md:w-72">
        <Card className="h-full md:sticky md:top-24 shadow-lg glass-card-premium" style={{ borderColor: 'var(--color-border)' }}>
          <CardHeader className="pb-4 border-b" style={{ borderColor: 'var(--color-border)', background: 'transparent' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                <CardTitle className="text-sm font-bold" style={{ color: 'var(--color-card-foreground)' }}>
                  Direct Messages
                </CardTitle>
              </div>
              {permission !== 'granted' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => requestPermission()}
                  className="h-8 gap-1 text-xs"
                  style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', border: '1px solid var(--color-border)' }}
                >
                  <Bell className="w-3 h-3" />
                  Enable Notifications
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 animate-pulse" style={{ background: 'var(--chart-1)' }} />
              {onlineCount} online • {users.length} total
            </p>
          </CardHeader>
          <CardContent className="flex max-h-[calc(100vh-12rem)] flex-col gap-1.5 overflow-y-auto p-3" style={{ background: 'transparent' }}>
            {loadingUsers && (
              <p className="text-center py-4" style={{ color: 'var(--color-muted-foreground)' }}>Loading users...</p>
            )}
            {!loadingUsers &&
              users.map((user) => {
                const isOnline = onlineUserIds.includes(user.id);
                const isActive = activeUserId === user.id;

                const label =
                  user.handle && user.handle !== ""
                    ? `@${user.handle}`
                    : (user.displayName ?? "User");
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setActiveUserId(user.id)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-all duration-200 transform hover:scale-[1.02]")}
                    style={isActive ? { background: 'var(--color-popover)', color: 'var(--color-popover-foreground)', border: '1px solid var(--color-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' } : { color: 'var(--color-muted-foreground)', background: 'transparent' }}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {user.avatarUrl && (
                        <AvatarImage src={user.avatarUrl} alt={label} />
                      )}
                    </Avatar>
                    <div className="min-w-0 flex flex-1 flex-col">
                      <span className="truncate text-[12px] font-semibold" style={{ color: 'var(--color-card-foreground)' }}>
                        {label}
                      </span>
                      <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: isOnline ? 'var(--chart-1)' : 'var(--muted-foreground)' }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "animate-pulse" : ""}`} style={{ background: isOnline ? 'var(--chart-1)' : 'var(--muted-foreground)' }} />
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </button>
                );
              })}
          </CardContent>
        </Card>
      </aside>
      <main className="flex-1">
        {activeUserId && activeUser ? (
          <DirectChatPanel
            otherUserId={activeUserId}
            otherUser={activeUser}
            socket={socket}
            connected={connected}
            onVideoCallClick={() => {
              videoCall.initiateCall(activeUserId, activeUser.displayName || activeUser.handle || "User");
            }}
            currentUserName={currentUserName}
          />
        ) : (
          <Card className="flex h-full items-center justify-center shadow-lg glass-card-premium" style={{ borderColor: 'var(--color-border)' }}>
            <CardContent className="text-center" style={{ color: 'var(--color-muted-foreground)' }}>
              <Users className="mx-auto mb-4 w-14 h-14 opacity-40" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm font-medium">
                Select a user to start chatting...
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Video call window */}
      {videoCall.activeCall && (
        <VideoCallWindow
          callId={videoCall.activeCall.callId}
          callerId={videoCall.activeCall.callerId}
          callerName={videoCall.activeCall.callerName}
          recipientId={videoCall.activeCall.recipientId}
          recipientName={videoCall.activeCall.recipientName}
          socket={socket}
          connected={connected}
          onCallEnd={videoCall.endCall}
          isIncoming={videoCall.activeCall.isIncoming}
        />
      )}

      {/* Incoming call notification (visible when no active call) */}
      {videoCall.incomingCall && !videoCall.activeCall && (
        <div
          ref={incomingCallModalRef}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-linear-to-br from-slate-900 to-slate-950 shadow-2xl shadow-black/50 overflow-hidden">
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-0 animate-pulse" />

            {/* Content */}
            <div className="relative z-10 p-8">
              <div className="text-center mb-6">
                <div className="mb-4 flex justify-center">
                  <div className="relative">
                    <Phone className="w-12 h-12 text-blue-400 animate-bounce" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white">Incoming Call</h2>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="font-semibold">{videoCall.incomingCall.callerName}</span> is calling...
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center mt-8">
                <button
                  onClick={() => {
                    if (incomingCallModalRef.current) {
                      gsap.to(incomingCallModalRef.current, {
                        opacity: 0,
                        scale: 0.95,
                        duration: 0.2,
                        onComplete: videoCall.acceptCall,
                      });
                    } else {
                      videoCall.acceptCall();
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-linear-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold shadow-lg hover:shadow-emerald-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95"
                >
                  <Phone className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => {
                    if (incomingCallModalRef.current) {
                      gsap.to(incomingCallModalRef.current, {
                        opacity: 0,
                        scale: 0.95,
                        duration: 0.2,
                        onComplete: videoCall.rejectCall,
                      });
                    } else {
                      videoCall.rejectCall();
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-linear-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold shadow-lg hover:shadow-red-500/50 transition-all duration-200 transform hover:scale-105 active:scale-95"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default chat;
