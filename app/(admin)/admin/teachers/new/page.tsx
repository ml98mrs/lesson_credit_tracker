// app/(admin)/admin/teachers/new/page.tsx
import Section from "@/components/ui/Section";
import NewTeacherForm from "./NewTeacherForm";

export default function NewTeacherPage() {
  return (
    <Section title="New teacher">
      <p className="mb-4 text-sm text-gray-600">
        Create a teacher account linked to a profile. You can assign students
        later from each student&apos;s page.
      </p>
      <NewTeacherForm />
    </Section>
  );
}
