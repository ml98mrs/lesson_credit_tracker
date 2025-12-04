// lib/enums.ts

export type EnumOf<T extends readonly string[]> = T[number];

// ─────────────────────────────────────────────────────────────
// Core teaching enums
// ─────────────────────────────────────────────────────────────

// Actual DB delivery enum: 'online' | 'f2f'
export const DELIVERY = ["online", "f2f"] as const;
export type Delivery = EnumOf<typeof DELIVERY>;

// For credit lots / invoices, NULL means "unrestricted" (UI shows this as "hybrid").
export type DeliveryRestriction = Delivery | null;

// Actual DB tier enum: 'basic' | 'premium' | 'elite'
export const TIER = ["basic", "premium", "elite"] as const;
export type Tier = EnumOf<typeof TIER>;

// UI-only display type: Student 360 shows "legacy" for old pricing.
export type TierDisplay = Tier | "legacy";

export const LENGTH_CAT = ["60", "90", "120", "none"] as const;
export type LengthCat = EnumOf<typeof LENGTH_CAT>;

export const LESSON_STATE = ["pending", "confirmed", "declined"] as const;
export type LessonState = EnumOf<typeof LESSON_STATE>;

export const SNC_MODE = ["none", "free", "charged"] as const;
export type SncMode = EnumOf<typeof SNC_MODE>;

// ─────────────────────────────────────────────────────────────
// Credit / expiry enums
// ─────────────────────────────────────────────────────────────

export const CREDIT_LOT_STATE = ["open", "closed", "expired", "cancelled"] as const;
export type CreditLotState = EnumOf<typeof CREDIT_LOT_STATE>;

export const EXPIRY_POLICY = ["none", "mandatory", "advisory"] as const;
export type ExpiryPolicy = EnumOf<typeof EXPIRY_POLICY>;

// ─────────────────────────────────────────────────────────────
// User / student lifecycle
// ─────────────────────────────────────────────────────────────

export const USER_ROLE = ["student", "teacher", "admin"] as const;
export type UserRole = EnumOf<typeof USER_ROLE>;

// NOTE:
// StudentStatus and TeacherStatus are now derived directly from DB row types:
// - lib/types/students.ts  → export type StudentStatus = StudentRow["status"];
// - lib/types/teachers.ts  → export type TeacherStatus = TeacherRow["status"];
// Do not reintroduce enum copies here to avoid drift.

// ─────────────────────────────────────────────────────────────
// Credit write-offs
// ─────────────────────────────────────────────────────────────

export const CREDIT_WRITE_OFF_DIRECTION = ["positive", "negative"] as const;
export type CreditWriteOffDirection = EnumOf<typeof CREDIT_WRITE_OFF_DIRECTION>;

export const CREDIT_WRITE_OFF_REASON = [
  "manual_write_off",
  "expired_credit",
  "overdraft_write_off",
  "adjustment",
] as const;
export type CreditWriteOffReason = EnumOf<typeof CREDIT_WRITE_OFF_REASON>;

// ─────────────────────────────────────────────────────────────
// Hazards
// ─────────────────────────────────────────────────────────────

export const HAZARD_TYPE = [
  "delivery_f2f_on_online",
  "delivery_online_on_f2f",
  "length_restriction_mismatch",
  "length_too_short",
  "snc_overuse",
  "overdraft_allocation",
  // Reserved for future expiry hazards (not yet in views):
  // "mandatory_expiry_breached",
] as const;

export type HazardType = EnumOf<typeof HAZARD_TYPE>;
