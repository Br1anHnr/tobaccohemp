"use client";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { STORAGE } from "@/lib/constants";
export function AgeGate() {
  const [state, setState] = useState<
    "loading" | "open" | "denied" | "accepted"
  >("loading");
  useEffect(() => {
    let confirmed = false;
    try {
      confirmed = localStorage.getItem(STORAGE.age) === "yes";
    } catch {
      /* Confirmation can last for this session without storage. */
    }
    const timer = setTimeout(
      () => setState(confirmed ? "accepted" : "open"),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  const confirm = () => {
    try {
      localStorage.setItem(STORAGE.age, "yes");
    } catch {
      /* Remain usable if browser storage is unavailable. */
    }
    setState("accepted");
  };
  return (
    <Modal
      open={state === "open" || state === "denied"}
      onClose={() => {}}
      title={
        state === "denied" ? "Até a próxima." : "Você tem 18 anos ou mais?"
      }
      description={
        state === "denied"
          ? "Esta experiência é destinada a pessoas maiores de 18 anos."
          : "Antes de entrar, confirme sua idade para continuar."
      }
      dismissible={false}
      className="age-gate"
    >
      <Logo />
      <span className="age-symbol">
        <ShieldCheck size={28} />
      </span>
      <p className="eyebrow">Bem-vindo à Tobacco Hemp</p>
      {state === "denied" ? (
        <Button onClick={() => window.location.replace("about:blank")}>
          Sair da loja
        </Button>
      ) : (
        <div className="age-actions">
          <Button onClick={confirm}>Sim, tenho 18+</Button>
          <Button variant="secondary" onClick={() => setState("denied")}>
            Sair
          </Button>
        </div>
      )}
      <small>Estilo e acessórios para a sua rotina.</small>
    </Modal>
  );
}
