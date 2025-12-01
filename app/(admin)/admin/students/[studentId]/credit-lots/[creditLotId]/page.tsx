// app/(admin)/admin/students/[studentId]/credit-lots/[creditLotId]/page.tsx

type CreditLotPageProps = {
  params: {
    studentId: string;
    creditLotId: string;
  };
};

export default function AdminStudentCreditLotPage({ params }: CreditLotPageProps) {
  const { studentId, creditLotId } = params;

  // Thin placeholder – you can wire this up to your credit lot
  // detail / allocations export later.
  return (
    <main className="p-4">
      <h1 className="mb-2 text-lg font-semibold">Credit lot details</h1>
      <p className="text-sm text-gray-700">
        Student: <span className="font-mono">{studentId}</span>
      </p>
      <p className="text-sm text-gray-700">
        Credit lot: <span className="font-mono">{creditLotId}</span>
      </p>
      <p className="mt-3 text-xs text-gray-500">
        This is a placeholder page so type-checking passes. Replace with a proper
        credit-lot detail view when you’re ready.
      </p>
    </main>
  );
}
