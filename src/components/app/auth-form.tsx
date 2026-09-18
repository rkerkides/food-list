"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { demoSignInAction, signInAction, signUpAction, type AuthState } from "@/app/actions/auth";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export function AuthForm() {
  const [signInState, signIn, signInPending] = useActionState<AuthState, FormData>(
    signInAction,
    {},
  );
  const [signUpState, signUp, signUpPending] = useActionState<AuthState, FormData>(
    signUpAction,
    {},
  );

  return (
    <div className="w-full space-y-5">
      <Tabs defaultValue="signin" className="space-y-5">
        <TabsList className="w-full">
          <TabsTrigger value="signin" className="flex-1">
            Sign in
          </TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">
            Create account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form action={signIn} className="space-y-4">
            {signInState.error ? <Alert variant="error">{signInState.error}</Alert> : null}
            <Field label="Email">
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={signInPending}>
              {signInPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Sign in
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form action={signUp} className="space-y-4">
            {signUpState.error ? <Alert variant="error">{signUpState.error}</Alert> : null}
            <Field label="Name">
              <Input name="name" autoComplete="name" placeholder="Reno" />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={signUpPending}>
              {signUpPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create account
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <div className="relative py-1 text-center">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <span className="relative bg-canvas px-3 text-xs text-ink-muted">or</span>
      </div>

      <form action={demoSignInAction}>
        <DemoButton />
      </form>
    </div>
  );
}

function DemoButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-clay-600" />}
      Explore the demo with Cyprus data
    </Button>
  );
}
