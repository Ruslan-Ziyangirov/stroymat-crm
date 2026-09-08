import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { OrderForm } from "@/components/orders/order-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getClientOptions, getManagers, getProducts, getStores } from "@/lib/queries/refs";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Новый заказ" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireProfile();
  const { client } = await searchParams;
  const [clients, products, stores, managers] = await Promise.all([
    getClientOptions(),
    getProducts(),
    getStores(),
    getManagers(),
  ]);

  return (
    <>
      <PageHeader
        title="Новый заказ"
        description="Выберите клиента, соберите состав заказа — сумма посчитается автоматически."
      />

      {clients.length === 0 ? (
        <Alert>
          <AlertTitle>Нет ни одного клиента</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            Чтобы оформить заказ, сначала заведите карточку клиента.
            <Button asChild size="sm">
              <Link href="/clients/new">Создать клиента</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <OrderForm
          clients={clients}
          products={products}
          stores={stores}
          managers={managers}
          defaultClientId={client}
        />
      )}
    </>
  );
}
