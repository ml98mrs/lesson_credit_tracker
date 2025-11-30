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
- **Teacher/Student (SSR / route handlers):**
  - Use `getServerSupabase` for general session-aware queries.
  - Teacher routes that need to **write auth cookies** (e.g. sign-in/out flows)
    may use `getTeacherSupabase()` from `lib/supabase/teacher.ts`,
    which wraps the same anon key but wires `cookies().set/delete` correctly.


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
- Expiry policy: `none`, `advisory`, `mandatory`.

none – no expiry; lot can be used indefinitely.

advisory – “soft” expiry; lots can still be used after the date, but they count towards “expiring soon” summaries and warnings.

mandatory – “hard” expiry; lots cannot be used after the expiry date unless an admin override is explicitly applied.

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
- `v_credit_lot_remaining` – per-lot remaining minutes, expiry flags, and overdraft detection.
- `v_lesson_hazards` – unresolved hazards per lesson/allocation.
- `v_teacher_rate_summary` – effective per-teacher rates (baseline + overrides).
- `v_teacher_usage_last_3m` – teacher usage last 3 months.
- `v_teacher_last_activity` – teacher last lesson date.
- `v_student_names` – student display names.
- `v_student_credit_summary` – canonical per-student totals (granted, allocated, remaining, next expiry date).
- `v_student_credit_delivery_summary` – per-student invoice credit split by delivery (online/F2F) and usage.
- `v_student_award_reason_summary` – per-student award minutes (granted/used/remaining) grouped by award_reason_code.
- `v_student_last_activity` – last confirmed lesson (or created_at) per student.
- `v_student_usage_last_3m` – per-student usage last 3 months (avg hours/month, heavy-user flag).
- `v_student_snc_lessons` – per-student SNC history (used to compute lifetime free/charged SNCs).
- `v_student_dynamic_credit_alerts` – overall low-credit signals per student (generic 6-hour rule + dynamic usage-based buffer). :contentReference[oaicite:5]{index=5}  
- `v_student_dynamic_credit_alerts_by_delivery` – per-delivery low-credit signals for purchased invoice credit only (online/F2F), including remaining minutes, average monthly usage, and buffer. :contentReference[oaicite:6]{index=6}  


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
- `mandatory`: “hard” expiry – cannot use an expired lot unless an explicit admin override is applied during lesson confirmation.
- `advisory`: “soft” expiry – lots can still be used after the expiry date, but they are treated as expiring for warnings and analytics (e.g. expiring-soon dashboards).
- `none`: ignore expiry completely (no warnings, no blocking).


### 6.3 SNC Rules (Expanded)
- Free SNC → plan empty; teacher paid.
- Charged SNC → normal allocation.

### 6.4 Student Lifecycle Rules
- `current`: active + remaining >= 0.
- `dormant`: auto after inactivity.
- `past`: manual or via write-off process.

### 6.5 Low-credit Rules & Alerts

Low-credit is computed in SQL and exposed via:
- `v_student_dynamic_credit_alerts` (overall per student)
- `v_student_dynamic_credit_alerts_by_delivery` (per-delivery: online / F2F, purchased credit only)

### 6.6 Domain Micro-modules (`lib/domain/*`)

Most business rules live in SQL views / functions. The frontend uses a small set of **domain micro-modules** in `lib/domain/*` to keep UI logic thin and consistent.

#### 6.6.1 SNC helpers — `lib/domain/snc.ts`

**SQL source of truth**

- `lessons.is_snc`, `lessons.snc_mode`
- `v_student_snc_lessons` (per-lesson SNC history)
- `v_student_snc_status_previous_month` (per-student SNC stats for last month)

**Responsibilities**

- `computeStudentSncStatus(rows)`  
  - Input: array of SNC lesson rows (e.g. from `v_student_snc_lessons`).  
  - Output: `{ freeSncs, chargedSncs, hasFreeSncUsed }` used by:
    - Student dashboard (lifetime SNC counts).
    - Admin Student 360 SNC summary.
  - Does **not** decide *which* SNCs are free vs charged — that is owned by SQL via `snc_mode` in `lessons` and the SNC views.
- All calendar-month boundaries and tier-based SNC rules remain in SQL; the helper only aggregates counts.

#### 6.6.2 Hazard helpers — `lib/domain/hazards.ts`

**SQL source of truth**

- `v_lesson_hazards` — one row per hazard per lesson/allocation.

**Responsibilities**

- `getHazardMeta(code)`  
  - Maps a `hazard_code` from `v_lesson_hazards` to:
    - A stable UI label.
    - Severity (e.g. warning vs blocking).
    - Short explanation/tooltips.
- `sortHazardsForDisplay(hazards)`  
  - Sorts hazards into a stable, user-friendly order for:
    - Admin lesson review page.
    - Any hazards list/summary panels.
- The helper never decides *whether* something is a hazard; it only decorates and orders rows produced by SQL.

#### 6.6.3 Expiry helpers — `lib/domain/expiryPolicy.ts`

**SQL source of truth**

- `credit_lots.expiry_policy` (`none` / `advisory` / `mandatory`)
- `v_credit_lot_remaining.expiry_within_30d`
- Any expiry analytics views.

**Responsibilities**

- `getExpiryPolicyLabel(policy)`  
  - Returns a short, user-facing label for the three policies, e.g. “No expiry”, “Soft advisory expiry”, “Hard mandatory expiry”.
- `getExpiryPolicyDescription(policy)`  
  - Returns a longer explanation for tooltips / banners (what the policy means in practice).
- Used by:
  - Admin **Add credit** UI when configuring/inspecting lots.
  - Student 360 & student dashboard expiry banners.
  - Any expiry summaries on the admin dashboard.
- All blocking rules (e.g. “mandatory lots cannot be used after expiry unless override”) and “within 30 days” cut-offs remain in SQL.

#### 6.6.4 Tier helpers — `lib/domain/tiers.ts`

**SQL source of truth**

- `students.tier` (enum: `basic`, `premium`, `elite`, `null`)
- SNC rules per tier (in SQL + SNC views).
- Teacher rate configuration per tier (in rate views).

#### 6.6.5 Delivery / lesson helpers — `lib/domain/lessons.ts`, `lib/domain/delivery.ts`

**SQL source of truth**

- `lessons.delivery` (enum: `online`, `f2f`)
- Any future hybrid flags live in SQL / views.

**Responsibilities**

- `formatDeliveryLabel(delivery)`  
  - Returns a **short, tabular** label for lesson delivery (e.g. `"Online"`, `"F2F"`).
  - Used in:
    - Admin lesson tables (queue, confirmed, Teacher 360 recent lessons).
    - Allocation tables (`LotAllocationsTable`).
    - Excel/XLSX exports where space is tight.
- `formatDeliveryUiLabel(deliveryUi)`  
  - UI-level label for delivery, including optional `"hybrid"` value.
  - Returns full words: `"Online"`, `"Face to face"`, `"Hybrid"`, or `"—"` if missing.
  - Used in:
    - Student/teacher-facing components where we want friendlier copy.
    - Any future hybrid-lesson UI.

**Rule of thumb**

- **Tables / compact views / exports** → `formatDeliveryLabel`.
- **High-level UI copy / badges / filters with hybrid** → `formatDeliveryUiLabel`.


**Responsibilities**

- `formatTierLabel(tier)`  
  - Maps internal tier values to consistent UI labels (e.g. “Basic package”, “Premium package”, “No package (legacy)”).
  - Used anywhere a tier is shown: admin Student 360, teacher/student dashboards, teacher rate screens.
- `compareTierDisplay(a, b)`  
  - Stable sort order for tiers in dropdowns or lists (e.g. `null` → `basic` → `premium` → `elite`).
- Tier helpers must not implement SNC or pricing rules; they only control **how tiers are displayed and ordered**.

> **Rule of thumb:**  
> - **SQL** decides *what is true* (SNC classification, hazards, expiry flags, tier pricing).  
> - **`lib/domain/*`** decides *how to present and aggregate that truth* for the UI in a single, reusable place.




**Overall low-credit (per student)**

- Generic rule (safety net):
  - `is_generic_low = remaining_minutes <= 360` (≤ 6 hours total remaining).
- Dynamic rule (usage-based buffer):
  - Compute `avg_month_hours` from confirmed lessons over the last 3 calendar months.
  - Compute `buffer_hours = remaining_hours - avg_month_hours`.
  - `is_dynamic_low = avg_month_hours > 0 AND buffer_hours < 4.0`.
- Combined:
  - `is_low_any = is_generic_low OR is_dynamic_low`.

These values drive:
- Admin dashboard “Low-credit students” count.
- Admin per-student low-credit banners.
- Student-facing low-credit banner when only one delivery mode is relevant.

**Per-delivery low-credit (online / F2F)**

For each student and delivery (`online`, `f2f`), `v_student_dynamic_credit_alerts_by_delivery`:

- Restricts to **invoice** lots:
  - `source_type = 'invoice'`, `state = 'open'`, not expired, delivery_restriction in (`online`, `f2f`).
- Aggregates:
  - `remaining_minutes` and `remaining_hours`.
  - `avg_month_hours` from last 3 months of confirmed lessons for that delivery.
  - `buffer_hours = remaining_hours - avg_month_hours`.
- Flags:
  - `is_generic_low` – same 6-hour rule, per delivery.
  - `is_dynamic_low` – same 4-hour buffer rule, per delivery.
  - `is_zero_purchased` – remaining_minutes ≤ 0 (no purchased credit left for that delivery).
  - `is_low_any` – `is_generic_low OR is_dynamic_low`.

These per-delivery rows power:
- Admin Student 360 per-delivery warnings (online vs F2F).
- Student portal “Low credit by delivery” banner when both online and F2F credit exist.


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
- Credit summary (purchased vs awarded, by delivery, driven by `v_student_credit_summary` and `v_student_credit_delivery_summary`).
- Award / bonus breakdown by reason (from `v_student_award_reason_summary`).
- SNC history + lifetime SNC status (from `v_student_snc_lessons`).
- Low-credit warnings:
  - Overall low credit (single-delivery students).
  - Per-delivery low credit (online vs F2F) when both exist.
- Expiry warnings (next mandatory expiry within 30 days, via `v_credit_lot_remaining.next_expiry_date` and `expiry_within_30d`).

Excellent — here is a **clean, polished, spec-quality rewrite** of the new feature exactly in the style, tone, structure, and level of abstraction of your existing master document.
It fits seamlessly into section **7. Student Portal** with proper hierarchy and matches the concision/precision of the rest of the spec.
No redundant detail; no implementation chatter; enough structure for the next AI helper to use reliably.

You can paste this directly into **ps_english_credit_portal_spec.md**.

I place it as **§7.4 Student Queries (Record Challenges)**.

---

# ✅ **Proposed Spec Integration — Full Rewrite (Section 7.4)**

## **7.4 Student Queries (Record Challenges)**

### **Purpose**

Students may occasionally believe a lesson log or a credit entry is incorrect (e.g. wrong duration, unexpected SNC charge, incorrect credit deduction).
To support a transparent and auditable correction process without relying on email, the portal provides a structured **Student Query** feature.

This system is **database-driven**: all workflow state, visibility, and ownership checks are implemented in SQL (tables, RLS, RPCs). The frontend acts as a thin UI shell.

---

### **7.4.1 Data Model**

#### **Table: `student_record_queries`**

Stores one query per disputed record.

* `id` (uuid, PK)
* `student_id` (uuid FK → students)
* `lesson_id` (uuid FK → lessons, nullable)
* `credit_lot_id` (uuid FK → credit_lots, nullable)
* `source` (text; default: `student_portal`)
* `status` (`open` | `in_review` | `resolved` | `dismissed`)
* `body` (text; student’s message)
* `admin_note` (text, nullable; admin reply)
* `resolution_code` (text, nullable)
* `student_seen_at` (timestamptz, nullable; notification acknowledgement)
* `created_at`, `updated_at`, `resolved_at` (timestamps)

Constraint:

* Exactly **one** of `lesson_id` or `credit_lot_id` must be non-null.

`updated_at` maintained by a standard `BEFORE UPDATE` trigger.

---

### **7.4.2 Access Control (RLS)**

Student portal (session-aware via `getServerSupabase`):

* **SELECT**: allowed only for rows where `student_id` matches the logged-in student.
* **INSERT**: allowed only when `student_id` matches the logged-in student.
* **UPDATE/DELETE**: not permitted.

Admin portal uses `getAdminSupabase` (service role; RLS bypass).
This preserves the portal’s “read-only for students” principle.

---

### **7.4.3 RPCs**

#### **`mark_student_record_queries_seen(p_query_ids uuid[])`**

Marks the listed queries as acknowledged (`student_seen_at = now()`), but **only** for rows owned by the calling student.
Used by the student dashboard to clear notifications.

---

### **7.4.4 Student Workflow**

#### **(1) Submitting a Query**

Each lesson or credit row in the student portal exposes a **“Query”** button.

* Student writes a short explanation.
* A new row is inserted into `student_record_queries`.
* Target is either `lesson_id` or `credit_lot_id`.
* No edits are allowed after submission.

This provides a structured, traceable alternative to emailing the school.

---

#### **(2) Viewing Admin Responses (Notifications)**

The student dashboard automatically loads any **unread admin replies**, defined as:

* `admin_note IS NOT NULL`
* `student_seen_at IS NULL`

These appear as dashboard notifications with:

* Title reflecting `status` (e.g. “Your query has been resolved”)
* Admin’s note
* Timestamp (displayed in the student’s timezone)
* A **“Mark as read”** action that calls the RPC

Once marked read, the query is not shown again.

---

#### **(3) Query History**

Page: **`/student/queries`**

* Lists all queries submitted by the student.
* Columns: created date, type (lesson/credit), status, student message, admin reply.
* Entirely read-only.

This supports transparency and reduces repeat queries.

---

### **7.4.5 Admin Workflow**

#### **(1) Dashboard Integration**

The Admin Dashboard includes a **“Student queries”** alert card showing:

* Count of rows where `status = 'open'`
* Link to `/admin/record-queries`

This surfaces outstanding student issues at a glance.

---

#### **(2) Review & Response**

Page: **`/admin/record-queries`** → lists all queries with filters
Page: **`/admin/record-queries/[queryId]`** → detail & response form

Admin actions:

* Read student message
* Add/update `admin_note`
* Set `status` (e.g. `in_review`, `resolved`)
* Optionally set `resolution_code`
* Use **“Clear query”** to mark as `resolved` quickly

All updates use `/api/admin/record-queries` and bypass RLS.

---

#### **(3) End of Cycle**

Once an admin has responded:

* Query is removed from the **admin dashboard** (no longer `status='open'`).
* Query becomes an **unread notification** for the student.
* Student marks it read → DB sets `student_seen_at` → notification disappears.
* Full history remains in `/student/queries`.

---

### **7.4.6 Principles**

* **SQL is authoritative** for workflow logic.
  The DB defines what is unread, resolved, dismissed, or visible.
* **Frontend is presentational**: shows database state, submits forms, triggers RPCs.
* Prevents direct email back-and-forth; ensures all corrections live inside the system.
* Ensures the student portal remains **strictly read-only** for core lesson and credit data.

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



Here is a **clean, concise spec-quality note block** describing all significant updates made in this phase.
This mirrors the tone and abstraction level of the existing master specification and can be added to the bottom of the doc (e.g. as **§A.6 Implementation Notes (2025-11 Updates)** or folded into the relevant sections).

---






# ✅ **Implementation Notes — Recent Structural Updates (Nov 2025)**

*(Add to spec as a short appendix section)*

The following updates modernise the Admin and Student portals, reducing duplication, improving consistency, and pushing more logic into SQL and shared components.

---

## **1. Shared CreditSnapshot Component (Admin / Teacher / Student)**

**What changed**

* All three portals previously contained near-duplicate “Purchased / Awarded / Used / Remaining” summary cards.
* These have been consolidated into a single shared component:
  **`<CreditSnapshot>`** in `components/credit/CreditSnapshot.tsx`.

**Why it matters**

* Ensures a single source of truth for summary formatting.
* Reduces React code size and likelihood of divergence.
* Enforces domain rule: *minutes in DB → hours (2dp) in UI*.

**Usage**

* `<CreditSnapshot>` now used on:

  * Student Dashboard
  * Student 360 (admin view)
  * Teacher portal student detail page

---

## **2. Shared Lot Allocations Table (Admin + Student)**

**What changed**

* Old `LotAllocations` (admin-only, minimal fields) has been replaced with a richer, modernised:
  **`<LotAllocationsTable>`**
* Backed by new SQL view: **`v_lot_allocations_detail`** (lesson date, teacher/student name, delivery, SNC, minutes, splice detection).

**Why it matters**

* Admin and Student portals now use the same table structure.
* Student portal hides admin-only actions (variant = `"student"`).
* Admin keeps links to lesson review (variant = `"admin"`).

**Key concept**

* **Spliced lesson detection** (multiple allocations for the same lesson) now surfaced at UI level.

---

## **3. New Student Query / Notification System**

**Core logic lives in SQL**, React is only a display layer.

**What changed**

* Added table: `student_record_queries`
* Added RPC: `mark_student_record_queries_seen`
* Student dashboard now shows **admin reply notifications**.
* Student query history page added.
* Admin dashboard now displays “open” student queries.
* Admin detail page gained **“Clear query”** action.

**Why it matters**

* Complete, auditable feedback loop inside the system.
* Student portal remains strictly read-only (RLS-safe).
* All unread replies disappear once student acknowledges.

---

## **4. Student 360 Page Refactor (Admin)**

**Major clean-up and reordering:**

1. Credit Snapshot moved **to the top**, matching student dashboard.
2. Low-credit / expiry warnings extracted into new
   **`<StudentWarningStrip>`**.
3. Tier / Status / Lifecycle grouped into a dedicated panel.
4. Teacher assignments and pricing snapshot grouped together.
5. Credit lots + per-lot allocations placed into their own panel.
6. SNC history placed at bottom.

**Why it matters**

* Far clearer 360 view for admins.
* Major reduction in file length.
* All React formatting helpers removed or shared (e.g. delivery labels).

---

## **5. Removal of React Helper Functions From Pages**

To follow the spec rule *“UI logic should not recreate domain logic”*:

* Delivery formatting moved into shared formatters (`formatDeliveryLabel`).
* Award lines built by shared helper (`buildAwardLine`).
* Student 360 removed all page-local formatting helpers.
* Avoids divergence between admin/teacher/student displays.

---

## **6. Consistent Time-zone Rules Applied Everywhere**

* Student dashboard now uses **student’s profile timezone** for notifications.
* All admin-side date displays use **formatDateTimeLondon**.
* All new tables (allocations, notifications) follow the same rule.

---

## **7. SQL Is Now Even More Authoritative**

These UI updates purposely rely on **SQL views**:

* `v_credit_lot_remaining` – canonical per-lot totals & expiry flags
* `v_student_credit_summary` – overall totals
* `v_student_credit_delivery_summary` – per-delivery splits
* `v_student_award_reason_summary` – award breakdown
* `v_student_snc_lessons` – SNC history
* **`v_lot_allocations_detail`** – NEW enriched allocation rows
* `v_student_dynamic_credit_alerts` – overall low credit
* `v_student_dynamic_credit_alerts_by_delivery` – per-delivery low credit

UI shows only what SQL decides.

---

## **8. General Clean-up**

* Large admin files shrunk by 30–40%.
* All pages using searchParams updated for **Next.js 16 (Promise-based)**.
* All pages handling allocations now rely on the new shared type:
  **`AllocationRow`** from `LotAllocationsTable`.
* Removed all redundant tables, duplicated layout, and old links.

---

Here’s a short set of update notes you can drop into a commit message or spec appendix.

---

### Update notes (domain + 360s + lessons)

* Added **`lib/domain/lessons.ts`**:

  * `AdminLessonListRow` shared type for admin lesson lists (queue, confirmed, etc.).
  * `formatDeliveryLabel`, `formatLessonLength`, `formatLessonState` for consistent lesson display.
  * `buildAdminLessonNameMaps` + `buildAdminNameOptionsFromMaps` to DRY student/teacher name loading + datalist options.

* Added **`lib/domain/teachers.ts`**:

  * `getTeacherStatusMeta` / `formatTeacherStatus` for consistent status badges (“Current / Inactive / Potential / Past”).
  * `formatTeacherMoney` and `formatTeacherHourlyRate` for pennies → `£` and `£/h` formatting.

* Extended **`lib/domain/students.ts`**:

  * `formatStudentStatus` for unified “Current / Dormant / Past” labels.
  * `mapCreditDeliverySummaryRow` to normalise `v_student_credit_delivery_summary` rows into a single domain type (all `?? 0` handled once). 

* Refactored **Admin Lessons**:

  * `/admin/lessons/queue` and `/admin/lessons/confirmed` now use `AdminLessonListRow`, `formatDeliveryLabel`, `formatLessonLength`, and `formatDateTimeLondon` for consistent lesson tables.
  * `LotAllocationsTable` now also uses `formatDeliveryLabel` so “F2F / Online” is identical everywhere.

* Refactored **Teacher 360 (`/admin/teachers/[teacherId]`)**:

  * Uses `getTeacherStatusMeta` for the status badge and teacher rate helpers for `£/h`.
  * Tightened types for assigned students using `StudentRow`.
  * Recent lessons now reuse lesson domain shape (`AdminLessonListRow` subset) and display `state` via `formatLessonState`.

* Refactored **Student 360 (`/admin/students/[studentId]`)**:

  * Student status badge now uses `formatStudentStatus` + a single status → class mapping.
  * Per-delivery invoice credit section now uses `mapCreditDeliverySummaryRow` instead of a local `StudentCreditDeliverySummary` + manual `?? 0` mapping.
  * Continues to use shared `CreditSnapshot`, `StudentWarningStrip`, and `LotAllocationsTable` to keep Admin vs Student portal behaviour aligned with the spec.
