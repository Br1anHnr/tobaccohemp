import { cache } from "react";
import { cookies } from "next/headers";
import { customerSessionCookie, customerSessionUser } from "@/modules/auth";
import { ensureSchema } from "@/shared/server/migrate";
import type { CustomerProfile } from "@/types/account";

/**
 * Resolves the signed-in storefront customer on the server from the httpOnly
 * session cookie. Returns null for guests, outside local/test auth mode, or
 * when no database is configured — without exposing tokens or failing the page.
 */
export const getStorefrontCustomer = cache(
  async (): Promise<CustomerProfile | null> => {
    if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) {
      return null;
    }
    if (!process.env.DATABASE_URL) {
      return null;
    }
    const cookieStore = await cookies();
    const token = cookieStore.get(customerSessionCookie)?.value;
    if (!token) {
      return null;
    }
    try {
      await ensureSchema();
      const account = await customerSessionUser(token);
      if (!account) return null;
      return {
        name: account.name,
        email: account.email,
        phone: account.phone,
        city: account.city,
        state: account.state,
      };
    } catch {
      console.error("[storefront] falha ao resolver a sessão do cliente.");
      return null;
    }
  },
);
