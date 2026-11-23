"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchAdminSession, sessionExpiredEvent } from "@/lib/admin-service";
import { ErrorState, LoadingState } from "./TableStates";

export function AdminSessionGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<{ path: string; state: "ready" | "error" | "login" | "forbidden" } | null>(null);

  useEffect(() => {
    if (path === "/admin/login") return;
    let cancelled = false;
    const fullPath =
      typeof window !== "undefined" && window.location.pathname === path && window.location.search
        ? `${path}${window.location.search}`
        : path;
    const expired = () => {
      if (cancelled) return;
      setChecked({ path, state: "login" });
      router.replace(`/admin/login?next=${encodeURIComponent(fullPath)}`);
    };
    window.addEventListener(sessionExpiredEvent, expired);
    fetchAdminSession().then(user => {
      if (cancelled) return;
      if (!user) expired();
      else if ((path === "/admin/asaas" || path === "/admin/teste-pagamento") && user.role !== "admin") {
        setChecked({ path, state: "forbidden" });
      } else setChecked({ path, state: "ready" });
    }).catch(() => { if (!cancelled) setChecked({ path, state: "error" }); });
    return () => { cancelled = true; window.removeEventListener(sessionExpiredEvent, expired); };
  }, [path, router, attempt]);

  if (path === "/admin/login") return children;
  if (checked?.path === path && checked.state === "forbidden") {
    return <p role="alert">Esta área exige uma conta de administrador.</p>;
  }
  if (checked?.path === path && checked.state === "error") {
    return <ErrorState text="Não foi possível verificar a sessão administrativa."
      onRetry={() => { setChecked(null); setAttempt(value => value + 1); }} />;
  }
  if (checked?.path !== path || checked.state !== "ready") return <LoadingState label="sessão" />;
  return children;
}
