// app/(admin)/admin/maintenance/page.tsx
import React from "react";
import Section from "@/components/ui/Section";
import MaintenancePanel from "@/components/admin/MaintenancePanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminMaintenancePage() {
  return (
    <Section
      title="Maintenance"
      subtitle="Manual tools for dormant students and long-term cleanup. Use with care."
    >
      <MaintenancePanel />
    </Section>
  );
}
