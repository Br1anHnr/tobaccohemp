import Link from "next/link";
import { ArrowRight } from "lucide-react";
export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>
          {title}
          <span className="accent-dot">.</span>
        </h2>
      </div>
      {action && (
        <Link href={action.href} className="text-link">
          {action.label}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
