import Section from '@/components/ui/Section';

export default function HelpPage() {
  return (
    <Section title="Help & FAQs">
      <ul className="list-disc ml-6 space-y-2 text-sm">
        <li>Students can view credit, lessons, and expiry warnings.</li>
        <li>Teachers can log lessons and expenses; invoices are generated monthly.</li>
        <li>Admins review lessons, confirm allocations, and manage policies.</li>
      </ul>
    </Section>
  );
}
