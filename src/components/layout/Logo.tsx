import Image from "next/image";
import { STORE } from "@/lib/constants";
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo-window ${className}`}>
      <Image
        src={STORE.logo}
        alt="Tobacco Hemp"
        width={1080}
        height={1350}
        priority
        className="official-logo"
      />
    </span>
  );
}
