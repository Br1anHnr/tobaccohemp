"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { drawerSpring } from "@/lib/animations";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  drawer = false,
  className = "",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  drawer?: boolean;
  className?: string;
  dismissible?: boolean;
}) {
  const reduced = useReducedMotion();
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      if (
        event.target instanceof HTMLElement &&
        !event.target.closest('[role="dialog"]')
      )
        opener.current = event.target;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value && dismissible) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          asChild
          onOpenAutoFocus={() => {
            if (
              document.activeElement instanceof HTMLElement &&
              !document.activeElement.closest('[role="dialog"]')
            )
              opener.current = document.activeElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (!dismissible) event.preventDefault();
          }}
        >
          <motion.div
            className={`${drawer ? "drawer" : "modal"} ${className}`}
            initial={
              reduced
                ? false
                : drawer
                  ? { x: "100%" }
                  : { opacity: 0, scale: 0.98, y: 10 }
            }
            animate={drawer ? { x: 0 } : { opacity: 1, scale: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : drawerSpring}
          >
            <Dialog.Title className="modal-title">{title}</Dialog.Title>
            <Dialog.Description className="modal-description">
              {description}
            </Dialog.Description>
            {dismissible && (
              <Dialog.Close
                className="icon-button modal-close"
                aria-label="Fechar"
              >
                <X size={22} />
              </Dialog.Close>
            )}
            {children}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
