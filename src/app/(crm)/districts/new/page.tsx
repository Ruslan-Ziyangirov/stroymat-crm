import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { DistrictForm } from "@/components/districts/district-form";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Новый анализ района" };

export default async function NewDistrictPage() {
  await requireRole(["admin", "director"]);

  return (
    <>
      <PageHeader
        title="Новый анализ района"
        description="Оценка пересчитывается сразу — можно подбирать сценарии и сравнивать варианты."
      />
      <DistrictForm />
    </>
  );
}
