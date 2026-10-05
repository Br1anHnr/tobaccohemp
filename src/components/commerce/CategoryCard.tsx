import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/types/category";
export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link className="category-card" href={`/categoria/${category.slug}`}>
      <Image
        src={category.image}
        alt=""
        fill
        sizes="(max-width: 767px) 220px, 250px"
      />
      <div>
        <span>{category.name}</span>
        <span className="circle-arrow">
          <ArrowUpRight size={17} />
        </span>
      </div>
    </Link>
  );
}
