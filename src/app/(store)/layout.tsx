import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { UtilityBar } from "@/components/layout/UtilityBar";
import { Footer } from "@/components/layout/Footer";
import { getStorefrontCategories, getStorefrontProducts } from "@/lib/storefront";
import { customerAuthEnabled } from "@/shared/server/preview";

export const revalidate = 60;

export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [products, categories] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCategories(),
  ]);
  const authAvailable = customerAuthEnabled() && Boolean(process.env.DATABASE_URL);
  return (
    <Providers
      products={products}
      categories={categories}
      authAvailable={authAvailable}
    >
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <UtilityBar />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </Providers>
  );
}
