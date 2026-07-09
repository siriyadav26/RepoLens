"use client";

import { ClientOnly } from "@/components/ClientOnly";
import AuthCard from "@/components/AuthCard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function LoginPage() {
  return (
    <ClientOnly>
      <main className="auth-container">
        <AuthCard />
      </main>
    </ClientOnly>
  );
}