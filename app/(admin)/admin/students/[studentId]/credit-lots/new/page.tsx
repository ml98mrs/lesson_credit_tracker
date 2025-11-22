// app/(admin)/admin/students/[studentId]/credit-lots/new/page.tsx

import { notFound } from "next/navigation";
import AddCreditModal from "./AddCreditModal";

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  // ✅ unwrap the Promise
  const { studentId } = await params;

  if (!studentId) notFound();

  // Render the full-screen add-credit UI
  return <AddCreditModal studentId={studentId} open={true} />;
}
