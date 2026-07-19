import { AuthGuard } from "@/components/AuthGuard";
import { GlobalNav } from "@/components/layout/global-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="global-layout">
        <GlobalNav />
        <main className="global-content">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}