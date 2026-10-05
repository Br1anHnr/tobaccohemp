import Link from "next/link";
import { ChevronRight } from "lucide-react";
export function PageIntro({
  title,
  text,
  eyebrow = "Tobacco Hemp",
  breadcrumbs = [],
}: {
  title: string;
  text?: string;
  eyebrow?: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="page-intro">
      <nav aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Início</Link>
          </li>
          {breadcrumbs.map((b) => (
            <li key={b.label}>
              <ChevronRight size={12} />
              {b.href ? (
                <Link href={b.href}>{b.label}</Link>
              ) : (
                <span aria-current="page">{b.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <p className="eyebrow">{eyebrow}</p>
      <h1>
        {title}
        <span className="accent-dot">.</span>
      </h1>
      {text && <p>{text}</p>}
    </div>
  );
}
