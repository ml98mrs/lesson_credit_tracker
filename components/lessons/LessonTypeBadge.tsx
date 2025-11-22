// components/lessons/LessonTypeBadge.tsx
import React from "react";

export type LessonTypeBadgeProps = {
  isSnc: boolean;
};

export default function LessonTypeBadge({ isSnc }: LessonTypeBadgeProps) {
  if (isSnc) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs text-amber-800">
        SNC
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      Lesson
    </span>
  );
}
