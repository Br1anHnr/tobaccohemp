export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  gallery?: string[];
  description: string;
  isNew: boolean;
  isFeatured: boolean;
  stock: number;
  variants?: string[];
  tags: string[];
}
