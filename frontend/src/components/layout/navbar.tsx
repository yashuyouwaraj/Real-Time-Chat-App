"use client";

import { SignedIn, SignedOut, useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Bell, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import { Notification } from "@/types/notification";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { toast } from "sonner";
import { Button } from "../ui/button";
import ThemeToggle from "./theme-toggle";

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { getToken, userId } = useAuth();
  const { socket } = useSocket();

  const { unreadCount, setUnreadCount, incrementUnread } =
    useNotificationCount();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadNotifications() {
      if (!userId) {
        if (isMounted) setUnreadCount(0);
        return;
      }

      try {
        const data = await apiGet<Notification[]>(
          apiClient,
          "/api/notifications?unreadonly=true"
        );

        if (!isMounted) return;
        setUnreadCount(data.length);
      } catch (e) {
        if (!isMounted) return;
        console.error("Error fetching notifications:", e);
      }
    }

    loadUnreadNotifications();

    return () => {
      isMounted = false;
    };
  }, [userId, apiClient, setUnreadCount]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleNewNotification = (payload: Notification) => {
      incrementUnread();

      toast("New Notification", {
        description:
          payload.type === "REPLY_ON_THREAD"
            ? `${payload.actor.handle ?? "Someone"} commented to your thread`
            : `${payload.actor.handle ?? "Someone"} liked your thread`,
      });
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [socket, incrementUnread]);

  const navItems = [
    {
      href: "/chat",
      label: "Chat",
      match: (p?: string | null) => p?.startsWith("chat"),
    },
    {
      href: "/profile",
      label: "Profile",
      match: (p?: string | null) => p?.startsWith("profile"),
    },
  ];

  const renderNavLinks = (item: (typeof navItems)[number]) => {
    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
        style={{
          background: "transparent",
          color: "var(--color-sidebar-foreground)",
          border: "1px solid transparent",
        }}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl shadow-lg"
      style={{
        background: "var(--color-sidebar)",
        color: "var(--color-sidebar-foreground)",
        borderBottom: "1px solid var(--color-sidebar-border)",
        boxShadow: "0 8px 24px rgba(2,8,20,0.12)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span style={{ background: "linear-gradient(90deg,var(--color-primary),var(--chart-3))", WebkitBackgroundClip: "text", color: "transparent" }}>
              Ace
            </span>
            <span style={{ color: "var(--color-sidebar-foreground)" }}>Chat</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(renderNavLinks)}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <SignedIn>
            <ThemeToggle />
            <Link href="/notifications">
              <button
                className="relative h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-110 active:scale-95"
                style={{
                  color: "var(--color-sidebar-foreground)",
                  background: "transparent",
                  border: "1px solid transparent",
                }}
              >
                <Bell className="h-4 w-4" />
                <span style={{ position: "absolute", right: -8, top: -8, minWidth: 20, minHeight: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9999, background: "linear-gradient(90deg,var(--destructive),#ef4444)", color: "white", fontSize: 10, fontWeight: 700, boxShadow: "0 6px 18px rgba(239,68,68,0.25)" }}>
                  {unreadCount > 0 ? unreadCount : 0}
                </span>
              </button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <ThemeToggle />
            <Link href="/sign-in">
              <button
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{
                  background: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                  boxShadow: "0 8px 24px rgba(14,165,233,0.12)",
                }}
              >
                Sign In
              </button>
            </Link>
          </SignedOut>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/30 bg-slate-800/50 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="border-t border-slate-700/30 bg-slate-900/90 backdrop-blur-sm md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-4 pt-2">
            {navItems.map(renderNavLinks)}
          </nav>        </div>
      )}
    </header>
  );
}

export default Navbar;