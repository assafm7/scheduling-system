import { AppShell } from "@/components/AppShell";
import { ClientOnlySchedulingsPage } from "@/components/ClientOnlySchedulingsPage";

export default function Home() {
  return (
    <AppShell>
      <ClientOnlySchedulingsPage />
    </AppShell>
  );
}
