# Performance Investigation: Submit Lag at Scale

**Date:** 2026-07-09  
**Status:** Fixes implemented in code (indexes migration + query/UX optimizations). Deploy via Render `prisma migrate deploy` on start.  
**Symptom:** After clicking the green Submit button, users wait several seconds before the task is submitted and the next task loads.  
**Context:** Worked fine at ~50k tasks; lag appeared after scaling to ~150k+ tasks.

---

## Verdict

The lag is **primarily a read / assignment problem**, not a write problem — amplified by **missing indexes** on the `Task` table.

| Path | Severity | Why |
|------|----------|-----|
| **Assign / load next tasks** (`assignUnassignedTasks`) | **Critical** | Heavy raw SQL over unindexed columns; runs when the user's 10-task queue is empty |
| **Progress counts** (`UserProgressStats`) | **High** | 3 sequential `COUNT` queries on unindexed filters; runs after every submit |
| **Fetch assigned tasks** (`getTasksOrAssignMore`) | **High** | Filters on `(group_id, state, *_id)` with no indexes |
| **Submit write** (`updateTask` by primary key) | **Low** | PK update is fast; not the main bottleneck |
| **`revalidatePath("/")` on every submit** | **Moderate** | Extra server overhead on every click |

**Bottom line:** The write (`UPDATE` by `id`) is cheap. The delay users feel is mostly waiting for the server action round-trip, and it gets much worse every 10th submit when the app must find and assign a new batch of unassigned tasks across 150k+ rows with **no useful indexes**.

---

## How Submit Works Today

```
Green Submit button
  → TaskView.updateTaskAndIndex()
      → await updateTask()          // Server Action: DB write + revalidatePath
      → getUserProgress()           // fire-and-forget: 3 COUNT queries
      → if queue has more tasks:
            remove current task locally   // fast
        else (last of 10):
            await getTasksOrAssignMore()  // may call assignUnassignedTasks — SLOW
```

Relevant files:

- `src/components/ActionButtons.js` — green submit button
- `src/components/TaskView.js` — submit handler + next-task logic
- `src/model/action.js` — `updateTask`, `getTasksOrAssignMore`, `assignUnassignedTasks`
- `src/model/task.js` — `UserProgressStats`, `getCompletedTaskCount`
- `prisma/schema.prisma` — Task model (no `@@index` directives)

---

## Root Causes

### 1. Missing indexes on `Task` (main scaling issue)

The `Task` table has **only a primary key on `id`**. There are no composite indexes for the columns used in every hot query.

Hot filters (all unindexed):

| Query | Filter columns |
|-------|----------------|
| Get assigned tasks | `group_id`, `state`, `transcriber_id` / `reviewer_id` / `final_reviewer_id` |
| Assign unassigned tasks | `group_id`, `state`, `*_id IS NULL`, `batch_id` |
| Progress counts | `*_id`, `group_id`, `state` |
| User history | `*_id`, `group_id`, `state`, order by timestamps |

At 50k rows this was tolerable. At 150k+ PostgreSQL increasingly falls back to sequential scans, so latency grows roughly with table size.

---

### 2. `assignUnassignedTasks` — heaviest operation (read + write)

Location: `src/model/action.js` (`assignUnassignedTasks`)

When a user's local queue of 10 tasks is empty, the app runs a raw SQL CTE that:

1. Scans all tasks matching `group_id` + `state` + assignee `IS NULL`
2. Runs `SELECT DISTINCT batch_id` with `SPLIT_PART` / `REGEXP_REPLACE` string parsing on every matching row
3. Orders batches and picks the first
4. Fetches up to 10 tasks (including **all 5 large TEXT context columns**)
5. Runs `updateMany` to assign them to the user

This is the most likely cause of multi-second delays on every 10th submit (and on first load when a user has no assigned tasks).

**Classification:** Read-heavy query that then does a small write. The slow part is finding the next batch, not the assignment update itself.

---

### 3. Progress stats: 3 sequential COUNT queries after every submit

Location: `src/model/task.js` (`UserProgressStats`)

Called from `TaskView` on every `taskList` change and after submit:

1. Count completed tasks for the user
2. Count total assigned tasks for the user
3. Count “passed” tasks for the user

Each count filters on unindexed `(group_id, *_id, state)`. As users complete more work, these counts get slower.

---

### 4. Blocking UI with no optimistic update

Location: `src/components/TaskView.js` (`updateTaskAndIndex`)

The UI **awaits** `updateTask` before removing the current task or loading the next one. There is no loading spinner / disabled state on the green button. Users experience the full server round-trip as a freeze.

Even when the write is fast (~tens of ms), network + Server Action + `revalidatePath` still feel like lag. When assignment runs, it feels like several seconds.

---

### 5. `revalidatePath("/")` on every submit

Location: `src/model/action.js` (`updateTask`, also `getUserHistory`)

The workflow is client-driven (task list lives in React state). Invalidating the entire home route cache on every submit adds unnecessary server work and does not help the next-task UX.

---

### 6. Over-fetching large TEXT columns

Task fetches always select:

- `diplomatic_context`
- `normalised_context`
- `corrected_context`
- `reviewed_context`
- `final_reviewed_context`

Roles typically need only 1–2 of these. At scale, transferring unused large text increases payload size and memory per request.

---

## Write vs Read: Clear Answer

| Question | Answer |
|----------|--------|
| Is the submit **write** the bottleneck? | **No.** `prisma.task.update({ where: { id } })` uses the primary key and should stay fast. |
| Is the **read / assign next task** the bottleneck? | **Yes**, especially when the queue is empty and `assignUnassignedTasks` runs. |
| Is missing indexing involved? | **Yes — this is the main structural cause.** Volume growth from 50k → 150k exposed the lack of indexes. |
| Why does *every* submit feel slow, not only every 10th? | Blocking Server Action + `revalidatePath` + progress COUNTs on every click; assignment makes every 10th submit much worse. |

---

## Recommended Solutions

### Priority 1 — Add composite indexes (highest impact, lowest risk)

Add to `prisma/schema.prisma` and migrate:

```prisma
model Task {
  // ... existing fields ...

  @@index([group_id, state, transcriber_id])
  @@index([group_id, state, reviewer_id])
  @@index([group_id, state, final_reviewer_id])
  @@index([group_id, state, batch_id])
  @@index([transcriber_id, state, group_id])
  @@index([reviewer_id, state, group_id])
  @@index([final_reviewer_id, state, group_id])
}
```

Equivalent SQL:

```sql
CREATE INDEX "Task_group_state_transcriber_idx"
  ON "Task" (group_id, state, transcriber_id);

CREATE INDEX "Task_group_state_reviewer_idx"
  ON "Task" (group_id, state, reviewer_id);

CREATE INDEX "Task_group_state_final_reviewer_idx"
  ON "Task" (group_id, state, final_reviewer_id);

CREATE INDEX "Task_group_state_batch_idx"
  ON "Task" (group_id, state, batch_id);

CREATE INDEX "Task_transcriber_state_group_idx"
  ON "Task" (transcriber_id, state, group_id);

CREATE INDEX "Task_reviewer_state_group_idx"
  ON "Task" (reviewer_id, state, group_id);

CREATE INDEX "Task_final_reviewer_state_group_idx"
  ON "Task" (final_reviewer_id, state, group_id);
```

**Expected impact:** Large reduction in latency for task fetch, assignment, history, and progress counts. This alone may restore “feels fast” behavior at 150k+.

> Tip: After deploying indexes, run `EXPLAIN ANALYZE` on `assignUnassignedTasks` and the COUNT queries to confirm index usage.

---

### Priority 2 — Simplify / rewrite `assignUnassignedTasks`

Options (pick one):

1. **Precompute batch order**  
   Store a numeric `batch_sort` (or separate `Batch` table with `sort_order`) so assignment can do a simple indexed `ORDER BY batch_sort LIMIT 1` instead of parsing `batch_id` with regex on every request.

2. **Narrow the CTE**  
   First find the next `batch_id` with a lean query (no TEXT columns), then fetch the 10 tasks by `batch_id`. Avoid `DISTINCT` + string functions over the full unassigned set when possible.

3. **Partial indexes for unassigned work**  
   ```sql
   CREATE INDEX "Task_unassigned_transcriber_idx"
     ON "Task" (group_id, state, batch_id)
     WHERE transcriber_id IS NULL;
   ```
   (and equivalents for reviewer / final reviewer)

**Expected impact:** Removes the multi-second spikes on every 10th submit.

---

### Priority 3 — Make submit feel instant (UX + request shape)

1. **Optimistic UI:** On submit, immediately remove the current task from `taskList` and show the next one; run `updateTask` in the background (with rollback/toast on failure).
2. **Loading state:** Disable the green button and show a spinner while the server action runs (minimum fix if optimistic UI is deferred).
3. **Prefetch next batch:** When 2–3 tasks remain in the queue, fetch/assign the next 10 in the background so the 10th submit never blocks on assignment.
4. **Remove `revalidatePath("/")`** from `updateTask` (and from `getUserHistory` if not needed). The client already owns the task list state.

---

### Priority 4 — Lighten progress and fetch queries

1. Combine the 3 progress `COUNT`s into one SQL query (or cache counts and increment/decrement on submit).
2. Select only the context columns needed for the current role.
3. Debounce or throttle progress refreshes so they don’t run on every single submit if not required for correctness.

---

## Suggested Implementation Order

1. **Add indexes** (deploy migration) — measure submit latency before/after.
2. **Remove `revalidatePath` from the submit hot path.**
3. **Prefetch next batch** when queue is nearly empty.
4. **Rewrite assignment query** / add partial indexes + batch sort column.
5. **Optimistic UI** + leaner progress stats.

---

## How to Confirm in Production / Staging

Run these while reproducing a slow submit:

```sql
-- See if queries are seq-scanning Task
EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT batch_id
FROM "Task"
WHERE group_id = <id>
  AND state = 'transcribing'
  AND transcriber_id IS NULL;

-- Check table size and index usage
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE relname = 'Task';

SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE relname = 'Task';
```

Also log timings around:

- `updateTask` (write)
- `getTasksOrAssignMore` / `assignUnassignedTasks` (read/assign)
- `UserProgressStats` (counts)

That will empirically confirm write vs read for your environment.

---

## Summary

| Finding | Detail |
|---------|--------|
| Root cause | Missing indexes + expensive unassigned-task assignment query at 150k+ rows |
| Write path | Mostly fine (PK update) |
| Read / assign path | Main bottleneck, especially every 10th submit |
| Quick win | Composite indexes on `(group_id, state, *_id)` and `(group_id, state, batch_id)` |
| UX win | Optimistic submit + prefetch next batch + drop `revalidatePath` on submit |
