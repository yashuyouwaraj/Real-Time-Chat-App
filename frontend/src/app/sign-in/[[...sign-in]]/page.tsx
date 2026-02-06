import { SignIn } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const user = await currentUser();

  // If already signed in, redirect to home
  if (user) redirect("/");

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 ">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome Back
          </h1>
        </div>
        <div>
          <div className="rounded-2xl border border-border/70 bg-card p-6 backdrop-blur-sm ">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              signInFallbackRedirectUrl="/"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            New here?
            <Link
              className="font-medium text-primary hover:text-primary/90"
              href={"/sign-up"}
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
