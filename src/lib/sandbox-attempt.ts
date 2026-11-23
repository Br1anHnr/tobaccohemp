export function sandboxOrderId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : null;
}

export function readSandboxAttempt(storageKey: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    return { key: sandboxOrderId(saved?.key), orderId: sandboxOrderId(saved?.orderId) };
  } catch {
    return { key: null, orderId: null };
  }
}

export function saveSandboxAttempt(storageKey: string, key: string, orderId: string | null) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ key, orderId }));
  } catch {
    if (!orderId) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("asaasOrder", orderId);
      window.history.replaceState(null, "", url);
    } catch {
      // The current page retains the attempt in memory.
    }
  }
}
