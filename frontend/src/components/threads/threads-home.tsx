"use client";

import { apiGet, createBrowserApiClient } from "@/lib/api-client";
import { Category, ThreadSummary } from "@/types/threads";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

function ThreadsHomePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [search, setSearch] = useState(searchParams.get("query") ?? "");
  const [activeCategory, setActiveCategory] = useState(
    searchParams.get("category") ?? "all",
  );

  const [isLoading, setIsLoading] = useState(false);

  // Fetch categories once on mount
  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const extractCategories = await apiGet<Category[]>(
          apiClient,
          "/api/threads/categories",
        );

        if (!isMounted) return;
        setCategories(extractCategories);
      } catch (err) {
        console.log("Failed to load categories", err);
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [apiClient]);

  // Fetch threads when category or search changes (debounced)
  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    async function loadThreads() {
      try {
        setIsLoading(true);

        const params: Record<string, unknown> = {};
        if (activeCategory && activeCategory !== "all") {
          params.category = activeCategory;
        }
        if (search && search.trim()) {
          params.query = search.trim();
        }

        const result = await apiGet<ThreadSummary[]>(
          apiClient,
          "/api/threads/threads",
          { params },
        );

        if (!isMounted) return;
        setThreads(result);

        // update URL (replace to avoid history spam)
        const qp = new URLSearchParams();
        if (params.category) qp.set("category", String(params.category));
        if (params.query) qp.set("query", String(params.query));
        const url = qp.toString() ? `?${qp.toString()}` : "/";
        router.replace(url);
      } catch (err) {
        console.log("Failed to load threads", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    // debounce when there's a search term
    if (search && search.trim()) {
      timer = setTimeout(() => {
        loadThreads();
      }, 350);
    } else {
      // immediate load when search is empty or category changed
      loadThreads();
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [apiClient, activeCategory, search, router]);

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-72">
        <Card className="sticky top-24 border-sidebar-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Categories</CardTitle>
              <Link href="/threads/new">
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/40"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => {
                setActiveCategory("all");
              }}
              className={`cursor-pointer flex w-full items-center px-3 py-3 text-sm font-medium transition-all duration-200 ${activeCategory === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card/80 hover:text-foreground"}`}
            >
              All Categories
            </button>
            {isLoading && (
              <div className="flex items-center justify-center rounded-lg border border-border bg-card py-10">
                <p className="text-sm text-muted-foreground">
                  Loading Categories
                </p>
              </div>
            )}
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => {
                  setActiveCategory(cat.slug);
                }}
                className={`cursor-pointer flex w-full items-center px-3 py-3 text-sm font-medium transition-all duration-200 ${activeCategory === cat.slug ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card/80 hover:text-foreground"}`}
              >
                {cat.name}
              </button>
            ))}
          </CardContent>
        </Card>
      </aside>
      <div className="flex-1 space-y-6">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Latest Threads
            </h1>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    className="pl-10 bg-secondary/80 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    placeholder="Search Threads..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // Trigger immediate search on Enter
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <Link href="/threads/new">
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto">
                <Plus className="w-4 h-4" />
                New Thread
              </Button>
            </Link>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card py-10 animate-fade-in">
              <p className="text-sm text-muted-foreground">
                Loading Threads...
              </p>
            </div>
          )}
          {!isLoading && threads.length === 0 && (
            <Card className="border-dashed border-border bg-card animate-fade-in">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No threads found.Create your first thread
                </p>
              </CardContent>
            </Card>
          )}
          {!isLoading &&
            threads.map((thread) => (
              <Card
                key={thread.id}
                className="group crusor-pointer border-border/70 bg-card transition-all duration-200 hover:border-primary/90 hover:bg-card/90 hover:shadow-sm animate-fade-in"
              >
                <Link href={`threads/${thread.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge
                            variant="outline"
                            className="border-border/70 bg-secondary/70 text-[12px]"
                          >
                            {thread.category.name}
                          </Badge>
                          {thread?.author?.handle && (
                            <span>by @{thread?.author?.handle}</span>
                          )}
                          <span>
                            {new Date(thread.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary">
                          {thread.title}
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {thread.excerpt}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}

export default ThreadsHomePage;
