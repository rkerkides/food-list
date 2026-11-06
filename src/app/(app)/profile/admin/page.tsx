import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPasswordReset } from "@/components/app/admin-password-reset";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { listAdminAccounts } from "@/lib/services/admin";

export const metadata = { title: "Manage users" };

export default async function AdminPage() {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  const accounts = await listAdminAccounts(user.id);
  if (!accounts) notFound();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/profile" className="text-sm text-ink-muted">← Profile</Link>
        <h1 className="font-display text-3xl font-semibold">Manage users</h1>
        <p className="text-sm text-ink-muted">{accounts.length} personal {accounts.length === 1 ? "account" : "accounts"}. The demo account is separate.</p>
      </header>
      {accounts.map((account) => (
        <Card key={account.id} className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{account.name}{account.id === user.id ? " (you)" : ""}</h2>
              <p className="text-sm text-ink-muted">{account.email}</p>
            </div>
            <Badge variant={account.isAdmin ? "olive" : "default"}>{account.isAdmin ? "Admin" : "Member"}</Badge>
          </div>
          {account.id !== user.id ? <AdminPasswordReset userId={account.id} name={account.name} /> : null}
        </Card>
      ))}
    </div>
  );
}
