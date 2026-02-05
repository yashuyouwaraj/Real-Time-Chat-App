"use client";

import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import {
  ChatUser,
  DirectMessage,
  mapDirectMessage,
  mapDirectMessagesResponse,
  RawDirectMessage,
} from "@/types/chat";
import { useAuth } from "@clerk/nextjs";
import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Socket } from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Send, Wifi, WifiOff, Phone } from "lucide-react";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { toast } from "sonner";
import ImageUploadButton from "./image-upload-button";
import { useBrowserNotification } from "@/hooks/use-browser-notification";

type DirectChatPanelProps = {
  otherUserId: number;
  otherUser: ChatUser | null;
  socket: Socket | null;
  connected: boolean;
  onVideoCallClick?: () => void;
  currentUserName?: string | null;
};

function DirectChatPanel(props: DirectChatPanelProps) {
  const { otherUser, otherUserId, socket, connected, onVideoCallClick, currentUserName } = props;
  const { getToken } = useAuth();
  const { sendNotification, requestPermission, permission } = useBrowserNotification();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<DirectMessage[]>([]);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 20;
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Request notification permission on mount
  useEffect(() => {
    if (permission === 'default') {
      requestPermission().catch(err => {
        console.log('Notification permission error:', err);
      });
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    // Intentionally no global autoscroll on `messages` changes.
    // We handle scrolling explicitly when appending to `displayMessages`
    // so the user won't be forced to scroll to bottom when viewing older messages.
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);

      try {
        const res = await apiGet<DirectMessage[]>(
          apiClient,
          `/api/chat/conversations/${otherUserId}/messages`,
          {
            params: {
              limit: 100,
            },
          }
        );

        if (!isMounted) return;
        const all = mapDirectMessagesResponse(res);
        setMessages(all);
        // show only last PAGE_SIZE messages initially
        const start = Math.max(0, all.length - PAGE_SIZE);
        setDisplayMessages(all.slice(start));
        // scroll to bottom after initial load
        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "auto" });
          }
        });
      } catch (err) {
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    }

    if (otherUserId) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [apiClient, otherUserId]);

  useEffect(() => {
    if (!socket) return;

    function handleMessage(payload: RawDirectMessage) {
      const mapped = mapDirectMessage(payload);

      if (
        mapped.senderUserId !== otherUserId &&
        mapped.recipientUserId !== otherUserId
      ) {
        return;
      }

      setMessages((prev) => {
        const next = [...prev, mapped];
        return next;
      });

      // Append to displayMessages if user is near bottom
      const el = containerRef.current;
      const isNearBottom = !el || el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;

      setDisplayMessages((prev) => {
        if (isNearBottom) {
          // append and schedule scroll to bottom
          const next = [...prev, mapped];
          requestAnimationFrame(() => {
            if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
          });
          return next;
        }
        // user is viewing older messages: don't disturb scroll — increment unread counter
        setNewMessagesCount((c) => c + 1);
        return prev;
      });

      // Send notification if user is receiving a message from the other user
      if (mapped.senderUserId === otherUserId) {
        sendNotification(`New message from ${otherUser?.displayName || otherUser?.handle || 'User'}`, {
          body: mapped.body || '📸 Image message',
          tag: `chat-${otherUserId}`,
          icon: otherUser?.avatarUrl || undefined,
        });
      }
    }

    function handleTyping(payload: {
      senderUserId?: number;
      receipientUserId?: number;
      isTyping?: boolean;
    }) {
      const senderId = Number(payload.senderUserId);

      if (senderId !== otherUserId) return;

      if (payload.isTyping) {
        setTypingLabel("Typing...");
      } else {
        setTypingLabel(null);
      }
    }

    socket.on("dm:message", handleMessage);
    socket.on("dm:typing", handleTyping);

    return () => {
      socket.off("dm:message", handleMessage);
      socket.off("dm:typing", handleTyping);
    };
  }, [socket, otherUserId]);

  function setSendTyping(isTyping: boolean) {
    if (!socket) {
      return;
    }

    socket.emit("dm:typing", { recipientUserId: otherUserId, isTyping });
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;

    setInput(value);

    if (!socket) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setSendTyping(true);

    typingTimeoutRef.current = setTimeout(() => {
      setSendTyping(false);
      typingTimeoutRef.current = null;
    }, 2000);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;

    // If user scrolled to top, try to prepend older messages
    if (el.scrollTop <= 12) {
      if (displayMessages.length === 0) return;

      const firstId = displayMessages[0].id;
      const firstIndex = messages.findIndex((m) => m.id === firstId);
      if (firstIndex <= 0) return; // no older messages

      const take = Math.min(PAGE_SIZE, firstIndex);
      const start = Math.max(0, firstIndex - take);
      const older = messages.slice(start, firstIndex);

      const prevScrollHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;

      setDisplayMessages((prev) => [...older, ...prev]);

      // restore scroll position to keep view stable
      requestAnimationFrame(() => {
        const newScrollHeight = el.scrollHeight;
        el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
      });
    }

    // If user is near bottom, clear unread counter and append any pending messages
    const isNearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 120;
    if (isNearBottom && newMessagesCount > 0) {
      // append pending messages from `messages` into displayMessages
      const lastDisplayedId = displayMessages.length > 0 ? displayMessages[displayMessages.length - 1].id : null;
      const lastIndex = lastDisplayedId ? messages.findIndex((m) => m.id === lastDisplayedId) : -1;
      const pending = lastIndex >= 0 ? messages.slice(lastIndex + 1) : messages;
      if (pending.length > 0) {
        setDisplayMessages((prev) => [...prev, ...pending]);
      }
      setNewMessagesCount(0);
      requestAnimationFrame(() => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  function showPendingMessages() {
    const lastDisplayedId = displayMessages.length > 0 ? displayMessages[displayMessages.length - 1].id : null;
    const lastIndex = lastDisplayedId ? messages.findIndex((m) => m.id === lastDisplayedId) : -1;
    const pending = lastIndex >= 0 ? messages.slice(lastIndex + 1) : messages;
    if (pending.length === 0) return;

    setDisplayMessages((prev) => [...prev, ...pending]);
    setNewMessagesCount(0);
    requestAnimationFrame(() => {
      if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function handleSend() {
    if (!socket || !connected) {
      toast("Not connected", {
        description: "Realtime connection is not established yet!",
      });

      return;
    }

    const body = input.trim();

    if (!body && !imageUrl) return;

    setSending(true);

    try {
      socket.emit("dm:send", {
        recipientUserId: otherUserId,
        body: body || null,
        imageUrl: imageUrl || null,
      });

      setInput("");
      setImageUrl("");
      setSendTyping(false);
    } finally {
      setSending(false);
    }
  }

  const title =
    otherUser?.handle && otherUser?.handle !== ""
      ? `@${otherUser?.handle}`
      : otherUser?.displayName ?? "Conversation";

  return (
    <Card className="relative flex h-full flex-col overflow-hidden border-border/50 glass-card-premium">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4" style={{ borderColor: 'var(--color-border)', background: 'transparent' }}>
        <div>
          <CardTitle className="text-base font-bold" style={{ color: 'var(--color-card-foreground)' }}>{title}</CardTitle>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Direct message</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onVideoCallClick}
            disabled={!connected}
            className="flex items-center justify-center h-9 w-9 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-110 active:scale-95 animate-call-ring"
            title="Start video call"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)', boxShadow: '0 8px 24px rgba(14,165,233,0.12)' }}
          >
            <Phone className="w-4 h-4" />
          </button>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300`}
            style={connected ? { background: 'var(--accent)', color: 'var(--accent-foreground)', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' } : { background: 'transparent', color: 'var(--color-muted-foreground)', border: '1px solid rgba(0,0,0,0.04)' }}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "animate-pulse" : ""}`} style={{ background: connected ? 'var(--chart-1)' : 'var(--muted-foreground)' }} />
            {connected ? "Online" : "Offline"}
          </div>
        </div>
      </CardHeader>

      <CardContent
        ref={(el) => (containerRef.current = el)}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
        style={{ background: "transparent", display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      >
        <div className="flex flex-col gap-4 w-full">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-2">
                <div className="h-12 w-3/4 rounded-lg animate-shimmer bg-[var(--color-popover)]" />
              </div>
            ))}
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-muted-foreground">
              No messages yet. Start the first initiative
            </p>
          </div>
        )}

        {!isLoading &&
          displayMessages.map((msg) => {
            console.log(msg.senderUserId, otherUserId, "otherUserId");

            const isOther = msg.senderUserId === otherUserId;
            const label = isOther ? title : "You";

            const time = new Date(msg.createdAt).toLocaleDateString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                className={`flex gap-2 text-xs ${
                  isOther ? "justify-start" : "justify-end"
                } animate-slide-in`}
                key={msg.id}
              >
                <div className={`max-w-xs ${isOther ? "" : "order-2"}`}>
                  <div
                    className={`mb-1.5 text-[11px] font-medium ${
                      isOther
                        ? "text-slate-400"
                        : "text-slate-400 text-right"
                    }`}
                  >
                    {label} • {time}
                  </div>

                  {msg?.body && (
                    <div
                      className={`inline-block rounded-lg px-3.5 py-2.5 transition-all duration-150 shadow-sm hover:shadow-lg hover:scale-105 glass-bubble`}
                      style={isOther ? { background: 'var(--bubble-incoming)', color: 'var(--bubble-incoming-foreground)', border: '1px solid var(--bubble-border)', backdropFilter: 'blur(8px) saturate(110%)', WebkitBackdropFilter: 'blur(8px) saturate(110%)' } : { background: 'var(--bubble-outgoing)', color: 'var(--bubble-outgoing-foreground)', border: '1px solid var(--bubble-border)', backdropFilter: 'blur(8px) saturate(110%)', WebkitBackdropFilter: 'blur(8px) saturate(110%)', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.12)' }}
                    >
                      <p className="wrap-break-word text-[15px] leading-relaxed font-medium" style={{ margin: 0 }}>
                        {msg.body}
                      </p>
                    </div>
                  )}

                  {msg?.imageUrl && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-600/30 shadow-md glass-bubble">
                      <img
                        src={msg.imageUrl}
                        alt="attachment"
                        className="max-h-52 max-w-xs rounded-lg object-cover hover:brightness-110 transition-all duration-200"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {typingLabel && (
          <div className="flex justify-start gap-2 text-xs">
            <div className="italic text-slate-400 font-medium">{typingLabel}</div>
          </div>
        )}
        </div>
        <div ref={messagesEndRef} />
      </CardContent>

      {/* new messages indicator (visible when user scrolled up) */}
      {newMessagesCount > 0 && (
        <div className="absolute left-1/2 z-40 -translate-x-1/2 mt-2">
          <button
            onClick={showPendingMessages}
            className="rounded-full bg-[#0ea5e9] px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {newMessagesCount} new message{newMessagesCount > 1 ? "s" : ""}
          </button>
        </div>
      )}

      <div className="space-y-3 border-t p-5" style={{ borderColor: 'var(--color-border)', background: 'transparent' }}>
        {imageUrl && (
          <div className="rounded-lg border border-slate-600/30 bg-slate-900/40 p-3 shadow-sm">
            <p className="text-[12px] text-slate-400 mb-2 font-medium">
              📸 Image ready to send
            </p>
            <img
              src={imageUrl}
              alt="pending"
              className="max-h-32 rounded-lg border border-slate-600/30 object-contain"
            />
          </div>
        )}

          <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* image upload component  */}
            <ImageUploadButton onImageUpload={(url) => setImageUrl(url)} />
            <span className="text-[11px] text-slate-400">Cloudinary</span>
          </div>

            <div className="flex gap-2">
            <Textarea
              rows={2}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
                disabled={!connected || sending}
                className="min-h-14 resize-none text-sm placeholder:text-[var(--muted-foreground)] rounded-lg focus:outline-none transition-all duration-200"
                style={{ background: 'var(--color-popover)', color: 'var(--color-popover-foreground)', borderColor: 'var(--color-border)' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !connected || (!input.trim() && !imageUrl)}
                className="flex items-center justify-center h-10 w-10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)', boxShadow: '0 8px 24px rgba(14,165,233,0.12)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Card>  );
}

export default DirectChatPanel;