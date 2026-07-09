-- Performance indexes for task assignment, fetch, and progress counts.
-- Safe: CREATE INDEX does not modify row data; only adds lookup structures.

CREATE INDEX "Task_group_id_state_transcriber_id_idx"
  ON "Task"("group_id", "state", "transcriber_id");

CREATE INDEX "Task_group_id_state_reviewer_id_idx"
  ON "Task"("group_id", "state", "reviewer_id");

CREATE INDEX "Task_group_id_state_final_reviewer_id_idx"
  ON "Task"("group_id", "state", "final_reviewer_id");

CREATE INDEX "Task_group_id_state_batch_id_idx"
  ON "Task"("group_id", "state", "batch_id");

CREATE INDEX "Task_transcriber_id_state_group_id_idx"
  ON "Task"("transcriber_id", "state", "group_id");

CREATE INDEX "Task_reviewer_id_state_group_id_idx"
  ON "Task"("reviewer_id", "state", "group_id");

CREATE INDEX "Task_final_reviewer_id_state_group_id_idx"
  ON "Task"("final_reviewer_id", "state", "group_id");

-- Partial indexes for the unassigned-task assignment hot path
CREATE INDEX "Task_unassigned_transcriber_idx"
  ON "Task"("group_id", "state", "batch_id")
  WHERE "transcriber_id" IS NULL;

CREATE INDEX "Task_unassigned_reviewer_idx"
  ON "Task"("group_id", "state", "batch_id")
  WHERE "reviewer_id" IS NULL;

CREATE INDEX "Task_unassigned_final_reviewer_idx"
  ON "Task"("group_id", "state", "batch_id")
  WHERE "final_reviewer_id" IS NULL;
