import { AuthGuard } from "@/components/AuthGuard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}