"use server";

import { formatTime } from "@/lib/formatTime";
import prisma from "@/service/db";
import { Prisma } from "@prisma/client";

const ASSIGN_TASKS = 10;
const MAX_HISTORY = 10;

const ROLE_PARAMS = {
  TRANSCRIBER: { state: "transcribing", taskField: "transcriber_id" },
  REVIEWER: { state: "submitted", taskField: "reviewer_id" },
  FINAL_REVIEWER: { state: "accepted", taskField: "final_reviewer_id" },
};

const getTaskSelectForRole = (role) => {
  const base = {
    id: true,
    group_id: true,
    batch_id: true,
    state: true,
    diplomatic_context: true,
    reviewer_rejected_count: true,
    final_reviewer_rejected_count: true,
  };

  switch (role) {
    case "TRANSCRIBER":
      return {
        ...base,
        normalised_context: true,
        corrected_context: true,
      };
    case "REVIEWER":
      return {
        ...base,
        corrected_context: true,
        reviewed_context: true,
        transcriber: { select: { name: true } },
      };
    case "FINAL_REVIEWER":
      return {
        ...base,
        reviewed_context: true,
        final_reviewed_context: true,
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
      };
    default:
      return {
        ...base,
        normalised_context: true,
        corrected_context: true,
        reviewed_context: true,
        final_reviewed_context: true,
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
      };
  }
};

/**
 * Retrieves user details by email from the database.
 *
 * @param {string} email - The email of the user to be fetched.
 * @returns {Object|null} The user data object if found, otherwise null.
 * @throws {Error} Throws an error if the database query fails.
 */
export const getUserDetails = async (email) => {
  try {
    const userData = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        group: true,
      },
    });
    // Return early if no user data is found
    if (!userData) {
      return null;
    }

    // Return the user data
    return userData;
  } catch (error) {
    console.error("Failed to retrieve user details:", error);
    throw new Error("Error fetching user details.");
  }
};

// get task based on username
export const getUserTask = async (email) => {
  let userTasks;
  const userData = await getUserDetails(email);
  if (userData === null) {
    return {
      error:
        "No user found. Please try again with the correct username or email.",
    };
  }
  // if user is found, get the task based on user role
  const { id: userId, group_id: groupId, role } = userData;
  const [tasks, history] = await Promise.all([
    getTasksOrAssignMore(groupId, userId, role),
    getUserHistory(userId, groupId, role),
  ]);
  userTasks = tasks;
  return { userTasks, userData, userHistory: history };
};

/**
 * Retrieves assigned tasks for a user based on their role or assigns more tasks if none are assigned.
 *
 * @param {number} groupId - The group ID to filter the tasks.
 * @param {number} userId - The user ID to assign tasks to.
 * @param {"TRANSCRIBER" | "REVIEWER" | "FINAL_REVIEWER"} role - The role of the user.
 * @returns {Promise<Array>} An array of tasks.
 * @throws {Error} Throws an error if unable to retrieve or assign tasks.
 */
export const getTasksOrAssignMore = async (groupId, userId, role) => {
  const roleConfig = ROLE_PARAMS[role];

  if (!roleConfig) {
    throw new Error(`Invalid role provided: ${role}`);
  }

  const { state, taskField } = roleConfig;

  try {
    let tasks = await prisma.task.findMany({
      where: { group_id: groupId, state, [taskField]: userId },
      select: getTaskSelectForRole(role),
      take: ASSIGN_TASKS,
    });

    if (tasks.length === 0) {
      tasks = await assignUnassignedTasks(groupId, state, taskField, userId);
    }

    return tasks;
  } catch (error) {
    console.error(
      `Failed to retrieve or assign tasks for role ${role}: ${error.message}`
    );
    throw new Error(
      `Failed to retrieve or assign tasks for role ${role}: ${error.message}`
    );
  }
};

/**
 * Prefetch a fresh batch of unassigned tasks (does not return already-queued assigned tasks).
 * Safe to call while the user still has a few tasks left in their client queue.
 */
export const prefetchNextTaskBatch = async (groupId, userId, role) => {
  const roleConfig = ROLE_PARAMS[role];
  if (!roleConfig) {
    throw new Error(`Invalid role provided: ${role}`);
  }
  const { state, taskField } = roleConfig;
  return assignUnassignedTasks(groupId, state, taskField, userId);
};

export const assignUnassignedTasks = async (
  groupId,
  state,
  taskField,
  userId
) => {
  // Step 1: resolve the next batch_ids. DISTINCT runs first (served by the
  // partial "Task_unassigned_*" indexes), so the prefix/numeric sort keys are
  // computed on the small distinct set instead of on every unassigned row.
  // Ordering semantics match the previous query (prefix, numeric part, batch_id).
  // Take up to ASSIGN_TASKS batch ids so nearly-exhausted batches (with only a
  // task or two left unassigned) don't produce short queues.
  const nextBatchRows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT batch_id
      FROM (
        SELECT DISTINCT batch_id
        FROM "Task"
        WHERE group_id = ${groupId}
          AND state = ${state}::"State"
          AND ${Prisma.raw(`"${taskField}"`)} IS NULL
      ) batches
      ORDER BY
        SPLIT_PART(batch_id, '-', 1) ASC,
        COALESCE(
          NULLIF(
            REGEXP_REPLACE(
              SPLIT_PART(batch_id, '-', 2),
              '[^0-9]',
              '',
              'g'
            ),
            ''
          )::INTEGER,
          0
        ) ASC,
        batch_id ASC
      LIMIT ${ASSIGN_TASKS}
    `
  );

  if (!nextBatchRows.length) {
    return [];
  }

  const batchIds = nextBatchRows.map((row) => row.batch_id);

  // Step 2: fill up to ASSIGN_TASKS tasks across those batches, in batch order.
  // A LATERAL per-batch LIMIT lets Postgres use the partial "Task_unassigned_*"
  // index and stop as soon as the queue is full — usually after the first batch —
  // instead of fetching and sorting every unassigned row in all selected batches.
  // Ordinality preserves batch priority; rows within a batch are unordered (as
  // before this optimization), which is fine since batch items are independent.
  const unassignedTasks = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        t.id,
        t.group_id,
        t.state,
        t.batch_id,
        t.diplomatic_context,
        t.normalised_context,
        t.corrected_context,
        t.reviewed_context,
        t.final_reviewed_context,
        t.reviewer_rejected_count,
        t.final_reviewer_rejected_count,
        tr.name AS "transcriber.name",
        r.name AS "reviewer.name"
      FROM unnest(${batchIds}::text[]) WITH ORDINALITY AS b(batch_id, ord)
      CROSS JOIN LATERAL (
        SELECT t2.*
        FROM "Task" t2
        WHERE t2.group_id = ${groupId}
          AND t2.state = ${state}::"State"
          AND t2.${Prisma.raw(`"${taskField}"`)} IS NULL
          AND t2.batch_id = b.batch_id
        LIMIT ${ASSIGN_TASKS}
      ) t
      LEFT JOIN "User" tr ON t.transcriber_id = tr.id
      LEFT JOIN "User" r ON t.reviewer_id = r.id
      ORDER BY b.ord ASC
      LIMIT ${ASSIGN_TASKS}
    `
  );

  if (unassignedTasks.length > 0) {
    await prisma.task.updateMany({
      where: {
        id: { in: unassignedTasks.map((task) => task.id) },
        // Guard against assigning tasks another user grabbed concurrently
        [taskField]: null,
      },
      data: { [taskField]: userId },
    });
  }

  // Normalize shape for clients that expect nested relation objects from Prisma.
  return unassignedTasks.map((task) => ({
    ...task,
    transcriber: task["transcriber.name"]
      ? { name: task["transcriber.name"] }
      : null,
    reviewer: task["reviewer.name"] ? { name: task["reviewer.name"] } : null,
  }));
};

// get all the history of a user based on userId
export const getUserHistory = async (userId, groupId, role) => {
  try {
    let whereCondition = {
      [`${role.toLowerCase()}_id`]: parseInt(userId),
      state:
        role === "TRANSCRIBER"
          ? { in: ["submitted", "trashed"] }
          : role === "REVIEWER"
          ? "accepted"
          : "finalised",
      group_id: parseInt(groupId),
    };

    const userHistory = await prisma.task.findMany({
      where: whereCondition,
      orderBy: [
        {
          final_reviewed_at: "desc",
        },
        {
          reviewed_at: "desc",
        },
        {
          submitted_at: "desc",
        },
      ],
      take: MAX_HISTORY,
    });
    return userHistory;
  } catch (error) {
    console.error("Failed to retrieve user history:", error);
    throw new Error("Failed fetching user history.");
  }
};

// Task state transitions based on roles and actions
const taskStateTransitions = {
  TRANSCRIBER: {
    submit: "submitted",
    trash: "trashed",
    default: "transcribing",
  },
  REVIEWER: {
    submit: "accepted",
    reject: "transcribing",
    default: "submitted",
  },
  FINAL_REVIEWER: {
    submit: "finalised",
    reject: "submitted",
    default: "accepted",
  },
};

// Function to change the state of a task based on user action
export const changeTaskState = (task, role, action) => {
  const newState =
    taskStateTransitions[role]?.[action] || taskStateTransitions[role]?.default;
  return { ...task, state: newState };
};

// update the takes based on user action
export const updateTask = async (
  action,
  id,
  transcript,
  task,
  role,
  currentTime
) => {
  const changedTask = changeTaskState(task, role, action);
  let duration = null;

  if (["submitted", "accepted"].includes(changedTask.state)) {
    const startTime = Date.parse(currentTime);
    const endTime = Date.now();
    const timeDiff = endTime - startTime;
    duration = formatTime(timeDiff);
  }

  // Initialize data to update with common fields
  const dataToUpdate = {
    state: changedTask.state,
  };

  // Add role-specific fields - business logic is now handled in the UI
  switch (role) {
    case "TRANSCRIBER":
      // Save the corrected_context (already processed by UI business logic)
      if (changedTask.state !== "trashed") {
        dataToUpdate.corrected_context = task.corrected_context;
      } else {
        dataToUpdate.corrected_context = null;
      }

      dataToUpdate.submitted_at = new Date().toISOString();
      dataToUpdate.duration = duration;
      break;

    case "REVIEWER":
      // Save the reviewed_context (already processed by UI business logic)
      if (changedTask.state === "accepted") {
        dataToUpdate.reviewed_context = task.reviewed_context;
      } else {
        dataToUpdate.reviewed_context = null;
      }

      dataToUpdate.reviewed_at = new Date().toISOString();
      dataToUpdate.reviewer_rejected_count =
        changedTask.state === "transcribing"
          ? task.reviewer_rejected_count + 1
          : task.reviewer_rejected_count;
      break;

    case "FINAL_REVIEWER":
      // Save the final_reviewed_context (already processed by UI business logic)
      if (changedTask.state === "finalised") {
        dataToUpdate.final_reviewed_context = task.final_reviewed_context;
      } else {
        dataToUpdate.final_reviewed_context = null;
      }

      dataToUpdate.final_reviewed_at = new Date().toISOString();
      dataToUpdate.final_reviewer_rejected_count =
        changedTask.state === "submitted"
          ? task.final_reviewer_rejected_count + 1
          : task.final_reviewer_rejected_count;
      break;
    default:
      // Optionally handle invalid roles or do nothing
      console.error(`Invalid role: ${role}`);
  }

  try {
    const updatedTask = await prisma.task.update({
      where: { id },
      data: dataToUpdate,
    });

    const msg = await taskToastMsg(action);

    return { msg, updatedTask };
  } catch (error) {
    console.error(`Error updating ${role} task:`, error);
    return { error: "Error updating task" };
  }
};

// Function to generate toast messages based on action
export const taskToastMsg = async (action) => {
  const actionSuccessMessages = {
    submit: "Task is submitted successfully",
    trash: "Task is trashed successfully",
    reject: "Task is rejected successfully",
  };

  return {
    success: actionSuccessMessages[action] || "Action performed successfully",
  };
};
