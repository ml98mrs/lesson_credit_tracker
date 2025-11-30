// lib/types/teachers.ts
import type { Database } from "@/lib/database.types";

// Raw DB row for a teacher
export type TeacherRow = Database["public"]["Tables"]["teachers"]["Row"];

// Status type derived from the DB enum
export type TeacherStatus = TeacherRow["status"];

// Optional camelCase domain type if you ever want it
export type Teacher = {
  id: TeacherRow["id"];
  profileId: TeacherRow["profile_id"];
  status: TeacherRow["status"];
  timeZone: TeacherRow["time_zone"] | null;
};
