"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, createBrowserApiClient } from "@/lib/api-client";
import { Category, ThreadDetail } from "@/types/threads";
import { useAuth } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const NewThreadScheman = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  body: z.string().min(10, "Description must be at least 10 characters"),
  categorySlug: z.string().trim().min(1, "Category is required"),
});

type NewThreadFormValues = z.infer<typeof NewThreadScheman>;

function NewThreadsPage() {
  const { getToken, userId, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSetDefaultCategory = useRef(false);

  // Debug: Log auth status
  useEffect(() => {
    console.log("Auth status:", { isLoaded, isSignedIn, userId });
    if (isLoaded && !isSignedIn) {
      toast.error("Authentication required", {
        description: "You must be signed in to create a thread.",
      });
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, userId, router]);

  const form = useForm<NewThreadFormValues>({
    resolver: zodResolver(NewThreadScheman),
    defaultValues: {
      title: "",
      body: "",
      categorySlug: "",
    },
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoadingCategories(true);

      try {
        const extractCat = await apiGet<Category[]>(
          apiClient,
          "/api/threads/categories",
        );

        if (!isMounted) return;

        setCategories(extractCat);

        if (!hasSetDefaultCategory.current && extractCat.length > 0) {
          form.setValue("categorySlug", extractCat[0].slug, {
            shouldValidate: true,
          });
          hasSetDefaultCategory.current = true;
        }
      } catch (err) {
        console.log("Failed to load Categores", err);
        toast.error("Failed to load categories", {
          description: "Please refresh the page and try again.",
        });
      } finally {
        if (isMounted) setIsLoadingCategories(false);
      }
    }
    load();

    return () => {
      isMounted = false;
    };
  }, [apiClient, form.setValue]);

  async function onThreadSubmit(values: NewThreadFormValues) {
    try {
      setIsSubmitting(true);
      console.log("Submitting thread with values:", values);
      const token = await getToken();
      console.log("Token exists:", !!token);
      
      const created = await apiPost<NewThreadFormValues, ThreadDetail>(
        apiClient,
        "/api/threads/threads",
        {
          title: values.title,
          body: values.body,
          categorySlug: values.categorySlug,
        }
      );

      console.log("Thread created:", created);
      toast.success("Thread created successfully", {
        description: "Your thread has been created.",
      });
      router.push(`/threads/${created?.id}`);
    } catch (error) {
      console.error("Failed to create new thread", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create thread. Please try again.";
      toast.error("Failed to create thread", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Start a new thread
        </h1>
      </div>
      <Card className="border-border/70 bg-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">
            Thread Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onThreadSubmit)}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label
                className="text-sm font-semibold text-foreground"
                htmlFor="title"
              >
                Thread Title
              </label>
              <Input
                id="title"
                placeholder="Thread Title"
                {...form.register("title")}
                disabled={isLoadingCategories || isSubmitting}
                className="border-border mt-3 bg-background/70 text-sm"
              />
              {form.formState.errors.title && (
                <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label
                className="text-sm font-semibold text-foreground"
                htmlFor="categorySlug"
              >
                Category
              </label>
              <Controller
                name="categorySlug"
                control={form.control}
                render={({ field }) => (
                  <select
                    id="categorySlug"
                    {...field}
                    disabled={
                      isLoadingCategories ||
                      isSubmitting ||
                      categories.length === 0
                    }
                    className="h-10 mt-3 w-full rounded-md border border-border bg-background/70 px-3 text-sm text-foreground focus:ring-2 focus:ring-primary/30 focus:outline-none"
                  >
                    {categories.length === 0 ? (
                      <option value="">
                        {isLoadingCategories
                          ? "Loading categories..."
                          : "No categories available"}
                      </option>
                    ) : (
                      categories.map((category) => (
                        <option value={category.slug} key={category.slug}>
                          {category.name}
                        </option>
                      ))
                    )}
                  </select>
                )}
              />
              {form.formState.errors.categorySlug && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.categorySlug.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-semibold text-foreground"
                htmlFor="body"
              >
                Description
              </label>
              <Textarea id="body" rows={8} placeholder="Thread description..." disabled={isLoadingCategories || isSubmitting} className="border-border mt-3 bg-background/70 text-sm" {...form.register("body")}/>
              {form.formState.errors.body && (
                <p className="text-xs text-red-500">{form.formState.errors.body.message}</p>
              )}
            </div>
            <CardFooter className="flex justify-end border-t border-border px-x pt-5">
                <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {isSubmitting ? "Submitting...":"Publish Thread"}
                </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default NewThreadsPage;
