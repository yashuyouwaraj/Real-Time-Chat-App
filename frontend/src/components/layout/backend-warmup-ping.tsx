"use client";

import { useEffect } from "react";

export default function BackendWarmupPing() {
  useEffect(() => {
    void fetch("/health", { method: "GET" }).catch(() => {});
  }, []);

  return null;
}