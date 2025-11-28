import { Suspense } from "react";
import ReviewLessonClient from "./ReviewLessonClient";

export const dynamic = "force-dynamic"; // optional, but fine to keep

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-gray-600">
          Loading review lesson…
        </div>
      }
    >
      <ReviewLessonClient />
    </Suspense>
  );
}
