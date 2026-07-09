"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const emptySubscribe = () => () => {};

export function ClientOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <main className="auth-container">
        <div className="auth-card" style={{ opacity: 0.6 }}>
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
        </div>
      </main>
    );
  }
  return <>{children}</>;
}