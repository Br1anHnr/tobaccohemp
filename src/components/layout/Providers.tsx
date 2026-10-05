"use client";
import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { useCart } from "@/store/cart-store";
import { CartDrawer } from "@/components/commerce/CartDrawer";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { AgeGate } from "@/components/age/AgeGate";
import { MobileMenu } from "./MobileMenu";
import { Modal } from "@/components/ui/Modal";
import { ButtonLink } from "@/components/ui/Button";
function AccountPreview() {
  const overlay = useCart((s) => s.overlay);
  const open = useCart((s) => s.setOverlay);
  return (
    <Modal
      open={overlay === "account"}
      onClose={() => open(null)}
      title="Sua seleção, do seu jeito."
      description="No MVP, você pode comprar como visitante. A área de conta estará disponível em uma próxima etapa."
    >
      <div
        className="account-links"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) open(null);
        }}
      >
        <ButtonLink href="/favoritos">Ver meus favoritos</ButtonLink>
        <ButtonLink href="/carrinho" variant="secondary">
          Ver meu carrinho
        </ButtonLink>
      </div>
    </Modal>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  const storageError = useCart((s) => s.storageError);
  useEffect(() => {
    Promise.resolve(useCart.persist.rehydrate()).finally(() =>
      useCart.setState({ hydrated: true }),
    );
  }, []);
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
