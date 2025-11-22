"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type StudentHit = {
  id: string;
  name: string;
};

type TeacherHit = {
  id: string;
  name: string;
};

type InvoiceHit = {
  id: string;
  invoiceRef: string;
  studentId: string;
  studentName: string | null;
};

type SearchResponse = {
  students: StudentHit[];
  teachers: TeacherHit[];
  invoices: InvoiceHit[];
};

export default function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();

    if (!trimmed) {
      setResults(null);
      setIsOpen(false);
      setError(null);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
  `/api/admin/search?q=${encodeURIComponent(trimmed)}`
);

if (!res.ok) {
  const text = await res.text().catch(() => "");
  console.error("Search request failed", res.status, text);
  setError("Search error");
  setIsOpen(false);
  return;
}

const data: SearchResponse = await res.json();

        setResults(data);

       const hasAny =
  !!(data.students.length || data.teachers.length || data.invoices.length);

setIsOpen(hasAny);
      } catch (err) {
        console.error(err);
        setError("Search error");
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 250); // 250–300ms feels good

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  function handleNavigateToStudent(studentId: string, invoiceRef?: string) {
    const url = invoiceRef
      ? `/admin/students/${studentId}?invoiceRef=${encodeURIComponent(
          invoiceRef
        )}`
      : `/admin/students/${studentId}`;

    router.push(url);
    setIsOpen(false);
    setQuery("");
  }

  function handleNavigateToTeacher(teacherId: string) {
    router.push(`/admin/teachers/${teacherId}`);
    setIsOpen(false);
    setQuery("");
  }

  function handleInvoiceClick(hit: InvoiceHit) {
    // For now jump to the owning student's page with invoiceRef
    handleNavigateToStudent(hit.studentId, hit.invoiceRef);
  }

  return (
    <div ref={containerRef} className="relative w-64">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results && (results.students.length || results.teachers.length || results.invoices.length)) {
            setIsOpen(true);
          }
        }}
        className="w-full rounded-full border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        placeholder="Search students, teachers, invoices…"
      />

      {isLoading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          …
        </span>
      )}

      {isOpen && results && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg text-sm max-h-80 overflow-auto">
          {error && (
            <div className="px-3 py-2 text-red-500 text-xs border-b">
              {error}
            </div>
          )}

          {/* Students */}
          {results.students.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">
                Students
              </div>
              {results.students.map((s) => (
                <button
                  key={`student-${s.id}`}
                  type="button"
                  onClick={() => handleNavigateToStudent(s.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50"
                >
                  <span className="flex-1">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Teachers */}
          {results.teachers.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">
                Teachers
              </div>
              {results.teachers.map((t) => (
                <button
                  key={`teacher-${t.id}`}
                  type="button"
                  onClick={() => handleNavigateToTeacher(t.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50"
                >
                  <span className="flex-1">{t.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Invoices */}
          {results.invoices.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">
                Invoices
              </div>
              {results.invoices.map((inv) => (
                <button
                  key={`invoice-${inv.id}`}
                  type="button"
                  onClick={() => handleInvoiceClick(inv)}
                  className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-gray-50"
                >
                  <span className="font-medium">
                    #{inv.invoiceRef}
                    {inv.studentName ? ` · ${inv.studentName}` : ""}
                  </span>
                  {inv.studentName && (
                    <span className="text-[11px] text-gray-500">
                      Go to student page
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!results.students.length &&
            !results.teachers.length &&
            !results.invoices.length &&
            !error && (
              <div className="px-3 py-2 text-xs text-gray-500">No matches</div>
            )}
        </div>
      )}
    </div>
  );
}
