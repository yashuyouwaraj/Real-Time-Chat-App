import { Suspense } from "react";
import ThreadsHomePage from "@/components/threads/threads-home";

export default function ThreadsPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <Suspense fallback={<div className="p-4 text-muted-foreground">Loading...</div>}>
        <ThreadsHomePage />
      </Suspense>
    </div>
  );
}