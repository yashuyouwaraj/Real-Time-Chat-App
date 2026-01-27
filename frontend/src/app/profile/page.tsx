"use client";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPatch, createBrowserApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const optionalText = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const ProfileSchema = z.object({
  displayName: optionalText,
  handle: optionalText,
  bio: optionalText,
  avatarUrl: optionalText,
});

type ProfileFormValues = z.infer<typeof ProfileSchema>;

type UserResponse = {
  id: number;
  clerkUserId: string;
  displayName: string | null;
  email: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

function ProfilePage() {
  const { getToken } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const apiClient = useMemo(() => createBrowserApiClient(getToken), [getToken]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      displayName: "",
      handle: "",
      bio: "",
      avatarUrl: "",
    },
  });
  async function onSubmit(values:ProfileFormValues) {
  try{
    setIsSaving(true)
    const payload:Record<string,string> = {}
    if(values.displayName) payload.displayName = values.displayName
    if(values.handle) payload.handle = values.handle
    if(values.bio) payload.bio = values.bio
    if(values.avatarUrl) payload.avatarUrl = values.avatarUrl

    const apiResponse = await apiPatch<typeof payload, UserResponse>(apiClient,"/api/me",payload)

    form.reset({
      displayName:apiResponse.displayName ?? "",
      handle:apiResponse.handle ?? "",
      bio:apiResponse.bio ?? "",
      avatarUrl:apiResponse.avatarUrl ?? ""
    })

    toast.success("Profile Updated Successfully",{
      description:"Your profile information has been updated."
    })
    
  } catch(e){
    console.log(e)
  } finally{
    setIsSaving(false)
  }
}

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);

        const getUserInfo = await apiGet<UserResponse>(apiClient, "/api/me");

        if (!isMounted) {
          return;
        }

        console.log(getUserInfo, "getUserInfo");

        form.reset({
          displayName: getUserInfo.displayName ?? "",
          handle: getUserInfo.handle ?? "",
          bio: getUserInfo.bio ?? "",
          avatarUrl: getUserInfo.avatarUrl ?? "",
        });
      } catch (err: any) {
        console.log(err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
  }, [apiClient, form]);

  const displayNameValue = form.watch("displayName");
  const handleValue = form.watch("handle");
  const avatarUrlValue = form.watch("avatarUrl");

  return (
    <>
      <SignedOut>User is SignedOut</SignedOut>
      <SignedIn>
        <div className=" mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 ">
          <div>
            <h1 className="flex items-center text-3xl font-bold tracking-tight text-foreground">
              <User className="w-8 h-8 text-primary" />
              Profile Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your Profile information
            </p>
          </div>

          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  {avatarUrlValue && (
                    <AvatarImage
                      src={avatarUrlValue || "/placeholder.xyz"}
                      alt={displayNameValue ?? ""}
                    />
                  )}
                </Avatar>

                <div className="flex-1">
                  <CardTitle className="text-2xl text-foreground">
                    {displayNameValue || "Your display name"}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        handleValue
                          ? "bg-primary/10 text-primary"
                          : "bg-accent text-accent-foreground",
                      )}
                    >
                      {handleValue ? `@${handleValue}` : "@handle"}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/70 bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="displaceName"
                      className="text-sm font-semibold text-foreground"
                    >
                      Display Name
                    </label>
                    <Input
                      id="displayName"
                      placeholder="Yashu Youwaraj"
                      {...form.register("displayName")}
                      disabled={isLoading || isSaving}
                      className="border-border mt-2 bg-background/60 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="handle"
                      className="text-sm font-semibold text-foreground"
                    >
                      Handle
                    </label>
                    <Input
                      id="handle"
                      placeholder="@yashu"
                      {...form.register("handle")}
                      disabled={isLoading || isSaving}
                      className="border-border mt-2 bg-background/60 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="bio"
                      className="text-sm font-semibold text-foreground"
                    >
                      Bio
                    </label>
                    <Textarea
                      id="bio"
                      placeholder="Tell about yourself!!!"
                      rows={4}
                      {...form.register("bio")}
                      disabled={isLoading || isSaving}
                      className="border-border mt-2 bg-background/60 text-sm"
                    />

                    {/* implement error state -> 1st task */}
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="avatarUrl" className="text-sm font-semibold text-foreground">Avatar URL</label>
                  <Input id="avatarUrl" placeholder="http://abc.com" {...form.register("avatarUrl")} disabled={isLoading || isSaving} className="border-border mt-2 bg-background/60 text-sm"/>
                </div>
                <CardFooter className="p-0">
                  <Button type="submit" disabled={isLoading|| isSaving} className="min-w-37.5 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Save className="mr-2 w-4 h-4"/>
                  {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardFooter>
              </form>
            </CardContent>
          </Card>
        </div>
      </SignedIn>
    </>
  );
}

export default ProfilePage;
