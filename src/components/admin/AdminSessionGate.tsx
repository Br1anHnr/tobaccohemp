"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchAdminSession, sessionExpiredEvent } from "@/lib/admin-service";
import { ErrorState, LoadingState } from "./TableStates";

export function AdminSessionGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<{ path: string; state: "ready" | "error" | "login" } | null>(null);

  useEffect(() => {
    if (path === "/admin/login") return;
    let cancelled = false;
    const expired = () => {
      if (cancelled) return;
      setChecked({ path, state: "login" });
      router.replace(`/admin/login?next=${encodeURIComponent(path)}`);
    };
    window.addEventListener(sessionExpiredEvent, expired);
    fetchAdminSession().then(user => {
      if (cancelled) return;
      if (!user) expired();
      else setChecked({ path, state: "ready" });
    }).catch(() => { if (!cancelled) setChecked({ path, state: "error" }); });
    return () => { cancelled = true; window.removeEventListener(sessionExpiredEvent, expired); };
  }, [path, router, attempt]);

  if (path === "/admin/login") return children;
  if (checked?.path === path && checked.state === "error") {
    return <ErrorState text="Não foi possível verificar a sessão. Confira se o backend local está em execução."
      onRetry={() => { setChecked(null); setAttempt(value => value + 1); }} />;
  }
  if (checked?.path !== path || checked.state !== "ready") return <LoadingState label="sessão" />;
  return children;
}
