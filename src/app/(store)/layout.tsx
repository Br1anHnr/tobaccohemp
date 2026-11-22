import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { UtilityBar } from "@/components/layout/UtilityBar";
import { Footer } from "@/components/layout/Footer";
import { getStorefrontCategories, getStorefrontProducts } from "@/lib/storefront";
import { getStorefrontCustomer } from "@/lib/storefront-session";

export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [products, categories, initialCustomer] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCategories(),
    getStorefrontCustomer(),
  ]);
  return (
    <Providers
      products={products}
      categories={categories}
      initialCustomer={initialCustomer}
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
