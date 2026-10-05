import { Hero } from "@/components/home/Hero";
import { CategoriesSection } from "@/components/home/CategoriesSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { PromoBanner } from "@/components/home/PromoBanner";
import { Benefits } from "@/components/home/Benefits";
export default function Home() {
  return (
    <>
      <Hero />
      <CategoriesSection />
      <FeaturedProducts />
      <PromoBanner />
      <Benefits />
    </>
  );
}
