import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { OrderForm } from "@/components/orders/order-form";
import { getClientOptions, getManagers, getProducts, getStores } from "@/lib/queries/refs";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Редактирование заказа" };

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const [{ data }, clients, products, stores, managers] = await Promise.all([
    supabase
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("id", id)
      .maybeSingle(),
    getClientOptions(),
    getProducts(),
    getStores(),
    getManagers(),
  ]);

  if (!data) notFound();

  const order = data as unknown as Order;
  order.items = (order.items ?? []).sort((a, b) => a.position - b.position);

  return (
    <>
      <PageHeader title={`Заказ ${order.number}`} description="Редактирование заказа" />
      <OrderForm
        order={order}
        clients={clients}
        products={products}
        stores={stores}
        managers={managers}
      />
    </>
  );
}
