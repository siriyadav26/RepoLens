"use client";

import { ClientOnly } from "@/components/ClientOnly";
import AuthCard from "@/components/AuthCard";

export default function Home() {
  return (
    <ClientOnly>
      <main className="auth-container">
        <AuthCard />
      </main>
    </ClientOnly>
  );
}