import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { DistrictForm } from "@/components/districts/district-form";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { DistrictAnalysis } from "@/lib/types";

export const metadata: Metadata = { title: "Редактирование анализа" };

export default async function EditDistrictPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("district_analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <>
      <PageHeader
        title="Редактирование анализа"
        description={(data as DistrictAnalysis).name}
      />
      <DistrictForm analysis={data as unknown as DistrictAnalysis} />
    </>
  );
}
