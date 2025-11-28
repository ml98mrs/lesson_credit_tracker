# PS English Credit Portal — Master Specification

## 1. Overview

The **PS English Credit Portal** is a multi‑portal web application used by an English language school to manage student lesson credits, teacher lesson logs, invoicing, SNC (short‑notice cancellations), credit expiry, student lifecycle, and business analytics.

This document is the **canonical working day‑to‑day specification**. All ChatGPT assistance must follow the rules and conventions defined here. Any ambiguity defaults to:

1. **SQL as source of truth**
2. **Existing enums/types in `lib/enums.ts`**
3. **Global domain rules:** minutes in DB, hours in UI (except lesson logs, which show minutes)

The system consists of:
- A **Next.js 16 App Router** web UI
- **Supabase** (Postgres + RPCs + RLS) backend
- Three user portals: **Admin**, **Teacher**, **Student**
- FIFO credit allocation engine
- SNC logic (tier‑based free/charged rules)
- Mandatory/optional expiry logic
- Teacher invoicing & payouts
- Analytics dashboards

---

## 2. High‑Level Architecture

### 2.1 Major Components
- **Next.js App Router** UI with route groups:
  - `(public)` – login, landing, onboarding
  - `(student)` – student portal (read‑only credit & SNC)
  - `(teacher)` – teacher portal (lesson logging, expenses, dashboard)
  - `(admin)` – admin back‑office (reviews, credits, invoicing, analytics)

- **Supabase (Postgres)** stores all domain data:
  - Lessons, allocations, credit lots, invoices, expenses
  - Views: `v_credit_lot_remaining`, `v_lesson_hazards`, etc.
  - RPCs: `rpc_confirm_lesson`, `rpc_decline_lesson`, `rpc_import_invoice`, etc.

- **RLS** protects student/teacher portals; admin bypasses using service‑role via `getAdminSupabase`.

### 2.2 Fundamental Data Flow
1. Admin imports or awards credit → creates **credit lots**.
2. Teachers log lessons → go into **pending** state.
3. Admin reviews lessons → allocation preview → confirm.
4. **fn_plan_lesson_allocation** computes FIFO allocation plan.
5. **rpc_confirm_lesson** materialises allocations.
6. Teacher invoices generate monthly earnings (lessons + expenses).
7. Students’ balances and SNC usage tracked by views.
8. Analytics surfaces business metrics.

---

## 3. Global Conventions

### 3.1 Time & Units
- **Database:** durations stored in **minutes**.
- **UI:** hours (to 2 dp) except:
  - **Lesson logs** always displayed in **minutes**.
- **Dates in DB:** UTC.
- **UI display:** Europe/London via helper `formatDateTimeLondon`.

### 3.2 Money
- **Pennies in DB**, convert to **£** in UI using `formatPenniesAsPounds`.

### 3.3 Naming
- **DB:** snake_case
- **Frontend:** camelCase
- **Query params:** explicit (`lessonId`, `teacherId`, `invoiceId`), never generic `id`.

### 3.4 Enums
Use enums from:
- `lib/enums.ts`
- `lib/types/profiles.ts`
Do **not** create local string unions that duplicate existing enum values.

### 3.5 Server Access
- **Admin portal:** always use `getAdminSupabase` (service role, no RLS).
- **Teacher/Student:** use `getServerSupabase` (session aware).

---

## 4. Roles & Portals

### 4.1 Admin Portal
Core capabilities:
- Review and confirm lessons
- Handle SNC logic and hazards
- Manage student credit, credit lots, expiries
- Add credit (invoice/award)
- Manage student lifecycle (current/dormant/past)
- Teacher rate configuration & overrides
- Teacher invoices & payouts
- Expense approvals
- Analytics & reports

### 4.2 Teacher Portal
Capabilities:
- Log lessons (pending → reviewed → confirmed)
- Log expenses
- View invoices (current month + history)
- Dashboard showing workload, earnings, SNCs, pending lessons
- Manage timetable & students (read‑only)

### 4.3 Student Portal (read‑only)
Capabilities:
- View remaining credits (by lot)
- View SNC usage
- View lesson history
- View expiry warnings

---

## 5. Core Domain Model

### 5.1 Lessons
- Stored in `lessons` table.
- Key fields: `duration_min`, `delivery`, `length_cat`, `occurred_at`, `student_id`, `teacher_id`, `state`, `is_snc`, `snc_mode`.
- States: `pending` → `confirmed` or `declined`.
- SNC rules handled at planning time.

### 5.2 Credit Lots
- Created via invoice import (`invoice`), award credits (`award`), adjustments.
- Fields: `minutes_granted`, `minutes_allocated`, `minutes_remaining` (via view), restrictions, `expiry_date`, `expiry_policy`.
- Expiry policy: `none`, `optional`, `mandatory`.

### 5.3 FIFO Allocation Engine
- Implemented in `fn_plan_lesson_allocation` (planner) and `rpc_confirm_lesson` (materialiser).
- Planner returns: ordered allocation plan + hazard flags.
- Mandatory expiry blocks lots unless admin override is used.

### 5.4 SNC System
- Tier-based:
  - `basic` → all SNCs charged.
  - `premium`/`elite` → first SNC per calendar month free.
  - `null tier` → exactly one free SNC ever.
- Free SNC → no allocations; teacher still gets paid.

### 5.5 Student Lifecycle
- Status: `current`, `dormant`, `past`.
- Auto-dormant: no activity older than N days.
- Write-offs: adjust remaining or overdraft.

### 5.6 Teacher Rates
- Stored in `teacher_rates` or overrides in `student_teacher_rates`.
- View `v_teacher_rate_summary` merges all.

### 5.7 Teacher Invoices
- Monthly period: previous calendar month.
- Lessons + approved expenses.
- States: `generated`, `paid`.

### 5.8 Teacher Expenses
- Table: `teacher_expenses`.
- Workflow: teacher logs → admin approves/rejects.
- Approved only influence invoices.

### 5.9 Hazards
- Delivery mismatch
- Length violation
- Negative balance (overdraft)
- Driven by views: `v_lesson_hazards`.

### 5.10 Core Views
- `v_credit_lot_remaining`
- `v_lesson_hazards`
- `v_teacher_rate_summary`
- `v_teacher_usage_last_3m`
- `v_teacher_last_activity`
- `v_student_names`

### 5.11 RPCs
- `rpc_confirm_lesson`
- `rpc_decline_lesson`
- `rpc_import_invoice`
- `rpc_award_minutes`
- Teacher invoices: monthly generator

---

## 6. Detailed Logic Rules

### 6.1 Allocation Logic
- Planner selects candidate lots based on:
  - Remaining minutes > 0
  - Delivery match priority
  - Restriction compatibility
  - Mandatory expiry (blocked unless override)
  - FIFO sort
- If shortfall → overdraft step appended.

### 6.2 Expiry Rules
- `mandatory`: cannot use expired lot unless override.
- `optional`: allow use after expiry.
- `none`: ignore expiry.

### 6.3 SNC Rules (Expanded)
- Free SNC → plan empty; teacher paid.
- Charged SNC → normal allocation.

### 6.4 Student Lifecycle Rules
- `current`: active + remaining >= 0.
- `dormant`: auto after inactivity.
- `past`: manual or via write-off process.

---

## 7. Portals (Detailed)

### 7.1 Admin
- Lesson queue
- Lesson review UI
- Add credit
- Student 360
- Teacher 360
- Teacher invoices
- Expense approvals
- Analytics hub

### 7.2 Teacher
- Dashboard: pending lessons, usage, invoice status
- Log lesson
- Log expense
- View students
- View invoices

### 7.3 Student
- Credit summary
- SNC history
- Expiry warnings

---

## 8. Admin Lesson Review Flow

1. Admin opens `/admin/lessons/review?lessonId=...`.
2. UI loads lesson + hazards + planner preview.
3. Admin edits delivery/length/duration.
4. Admin may tick **override expiry** (only shown when mandatory-expiry breach detected).
5. Confirm → saves edits → calls `rpc_confirm_lesson`.
6. Allocations created + hazards resolved.

---

## 9. Teacher Invoices & Payouts

### 9.1 Invoice Generation
- Auto-generated monthly based on confirmed lessons.

### 9.2 Payout Batch (Future)
- Admin page listing all teachers with unpaid invoices.
- Bulk mark-paid.
- Teachers see dashboard update.

---

## 10. Teacher Expenses

### 10.1 Logging
- Teachers must select category + student.

### 10.2 Admin Approval
- PATCH `/api/admin/teacher-expenses`.

### 10.3 Teacher-side Deletion
- Allowed only while pending.

---

## 11. Analytics & Business Intelligence

### 11.1 Revenue vs Cost
- View: `v_lesson_margin_with_drinks_with_names`.
- Teacher-by-month summaries.
- Lesson-level margins.

### 11.2 SNC Analytics
- View: `v_snc_stats_by_month`.
- Metrics:
  - SNC counts
  - Free vs charged SNCs
  - Revenue impact

### 11.3 Expiry Analytics
- Future view: `v_credit_expiry_by_month`.

### 11.4 Cohort & Reactivation
- Based on first lesson month.
- Retention over 3/6/12 months.
- Reactivation counts.

---

## 12. Routes & File Structure

### 12.1 Route Groups
- `/admin/...`
- `/teacher/...`
- `/student/...`

### 12.2 Key Pages
- `/admin/teachers/[teacherId]`
- `/admin/students/[studentId]`
- `/admin/lessons/queue`
- `/admin/analytics/...`

---

## 13. API Conventions
- JSON payloads use camelCase.
- Query params always explicit.
- Admin API uses service-role; teacher/student uses session.

---

## 14. Future Extensions
- Batch payouts
- Teacher CRM
- Predictive expiry forecasts
- Timetable utilisation
- Automated dormant clean-up page

---

## 15. Appendix
- Enum definitions
- RPC signatures
- Hazard definitions

