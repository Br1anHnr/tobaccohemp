import type { Category } from "@/types/category";
export const categories: Category[] = [
  {
    slug: "cases",
    name: "Cases",
    description:
      "Seus essenciais, sempre no lugar. Cases para acompanhar a rotina.",
    image: "/products/case.webp",
  },
  {
    slug: "shoulder-bags",
    name: "Shoulder bags",
    description: "Leve com você. Bolsas compactas com presença urbana.",
    image: "/products/bag.webp",
  },
  {
    slug: "bandejas",
    name: "Bandejas",
    description: "Um lugar para cada detalhe. Organização com personalidade.",
    image: "/products/tray.webp",
  },
  {
    slug: "organizadores",
    name: "Organizadores",
    description:
      "Menos bagunça, mais praticidade. Pequenos acessórios para o dia a dia.",
    image: "/products/organizer.webp",
  },
  {
    slug: "kits",
    name: "Kits",
    description: "Combinações de acessórios para deixar sua rotina completa.",
    image: "/products/kit.webp",
  },
];
export const getCategory = (slug: string) =>
  categories.find((category) => category.slug === slug);
