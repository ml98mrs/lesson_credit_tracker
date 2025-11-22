import Section from '@/components/ui/Section';

export default function SessionExpired() {
  return (
    <Section title="Session expired" subtitle="Please sign in again.">
      <a className="inline-block px-4 py-2 rounded bg-black text-white" href="/login">Go to login</a>
    </Section>
  );
}
