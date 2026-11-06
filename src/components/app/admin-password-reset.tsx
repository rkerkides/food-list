"use client";

import { useActionState } from "react";
import { resetAccountPasswordAction } from "@/app/actions/admin";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function AdminPasswordReset({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(resetAccountPasswordAction, {});
  return (
    <details className="border-t border-line pt-4">
      <summary className="cursor-pointer text-sm font-medium text-clay-700">Reset password for {name}</summary>
      <form action={action} className="mt-4 max-w-md space-y-4">
        <input type="hidden" name="targetUserId" value={userId} />
        {state.error ? <Alert variant="error">{state.error}</Alert> : null}
        {state.success ? <Alert variant="success">{state.success}</Alert> : null}
        <div className="space-y-1.5">
          <Label htmlFor={`${userId}-current`}>Your current password</Label>
          <Input id={`${userId}-current`} name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024} disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${userId}-new`}>New password for {name}</Label>
          <Input id={`${userId}-new`} name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={pending} />
          <p className="text-xs text-ink-muted">Use 8–128 characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${userId}-confirm`}>Confirm new password</Label>
          <Input id={`${userId}-confirm`} name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={pending} />
        </div>
        <p className="text-sm text-ink-muted">This signs {name} out on all devices. Share the new password with them so they can sign in again.</p>
        <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Set new password"}</Button>
      </form>
    </details>
  );
}
