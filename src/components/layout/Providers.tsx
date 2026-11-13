"use client";
import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { useCatalog } from "@/store/catalog-store";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";
import { CartDrawer } from "@/components/commerce/CartDrawer";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { AgeGate } from "@/components/age/AgeGate";
import { MobileMenu } from "./MobileMenu";
import { Modal } from "@/components/ui/Modal";
import { ButtonLink } from "@/components/ui/Button";
function AccountPreview() {
  const overlay = useCart((s) => s.overlay);
  const open = useCart((s) => s.setOverlay);
  const demo = useAccount((s) => s.demo);
  const customer = useAccount((s) => s.customer);
  const authed = Boolean(customer) || demo;
  return (
    <Modal
      open={overlay === "account"}
      onClose={() => open(null)}
      title="Sua seleção, do seu jeito."
      description={
        authed
          ? customer
            ? "Você está conectado à sua conta."
            : "Você está navegando na área do cliente demonstrativa."
          : "Entre para acompanhar seus dados e pedidos, ou continue comprando como visitante."
      }
    >
      <div
        className="account-links"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) open(null);
        }}
      >
        {authed ? (
          <ButtonLink href="/conta">Ir para minha conta</ButtonLink>
        ) : (
          <>
            <ButtonLink href="/conta/entrar">Entrar</ButtonLink>
            <ButtonLink href="/conta/cadastro" variant="secondary">
              Criar conta
            </ButtonLink>
          </>
        )}
        <ButtonLink href="/favoritos" variant="secondary">
          Ver meus favoritos
        </ButtonLink>
        <ButtonLink href="/carrinho" variant="ghost">
          Ver meu carrinho
        </ButtonLink>
      </div>
    </Modal>
  );
}
export function Providers({
  children,
  products,
  categories,
}: {
  children: ReactNode;
  products: Product[];
  categories: Category[];
}) {
  const storageError = useCart((s) => s.storageError);
  useEffect(() => {
    // Seed the runtime catalog before rehydrating the cart, whose `merge`
    // validates persisted items against the product list.
    useCatalog.getState().setCatalog(products, categories);
    Promise.resolve(useCart.persist.rehydrate()).finally(() =>
      useCart.setState({ hydrated: true }),
    );
    Promise.resolve(useAccount.persist.rehydrate()).finally(() =>
      useAccount.setState({ hydrated: true }),
    );
  }, [products, categories]);
  return (
    <MotionConfig reducedMotion="user">
      {children}
      {storageError && (
        <p className="storage-notice" role="status">
          O navegador não pôde salvar seu carrinho. Sua seleção permanece
          disponível nesta sessão.
        </p>
      )}
      <CartDrawer />
      <SearchOverlay />
      <MobileMenu />
      <AccountPreview />
      <AgeGate />
    </MotionConfig>
  );
}
