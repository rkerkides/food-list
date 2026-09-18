import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth/session";
import { describeProvider } from "@/lib/places";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const provider = describeProvider();

  return (
    <AppShell provider={provider} user={{ name: user.name, isDemo: user.isDemo }}>
      {children}
    </AppShell>
  );
}
