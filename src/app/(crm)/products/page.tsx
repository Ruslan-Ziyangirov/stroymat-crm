import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ProductsManager, type ProductRow } from "@/components/settings/products-manager";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Номенклатура" };

export default async function ProductsPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase.from("products").select("*").order("name");
  const products = (data ?? []) as Product[];

  const rows: ProductRow[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    price: Number(product.price ?? 0),
    is_active: product.is_active,
  }));

  return (
    <>
      <PageHeader
        title="Номенклатура"
        description="Справочник материалов: цены подставляются в состав заказа автоматически."
      />
      <ProductsManager data={rows} />
    </>
  );
}
