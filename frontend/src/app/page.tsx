import { Suspense } from "react";
import BackendWarmupPing from "@/components/layout/backend-warmup-ping";
import ThreadsHomePage from "@/components/threads/threads-home";

export default function ThreadsPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <BackendWarmupPing />
      <Suspense fallback={<div className="p-4 text-muted-foreground">Loading...</div>}>
        <ThreadsHomePage />
      </Suspense>
    </div>
  );
}