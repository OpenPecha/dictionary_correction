"use server";

import { formatTime } from "@/lib/formatTime";
import prisma from "@/service/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

const ASSIGN_TASKS = 10;
const MAX_HISTORY = 10;
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
  userTasks = await getTasksOrAssignMore(groupId, userId, role);
  const userHistory = await getUserHistory(userId, groupId, role);
  return { userTasks, userData, userHistory };
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
  // Define role-specific parameters
  const roleParams = {
    TRANSCRIBER: { state: "transcribing", taskField: "transcriber_id" },
    REVIEWER: {
      state: "submitted",
      taskField: "reviewer_id",
    },
    FINAL_REVIEWER: {
      state: "accepted",
      taskField: "final_reviewer_id",
    },
  };

  const { state, taskField } = roleParams[role];

  if (!state || !taskField) {
    throw new Error(`Invalid role provided: ${role}`);
  }

  try {
    let tasks = await prisma.task.findMany({
      where: { group_id: groupId, state, [taskField]: userId },
      select: {
        id: true,
        group_id: true,
        batch_id: true,
        state: true,
        inference_transcript: true,
        transcript: true,
        reviewed_transcript: true,
        final_reviewed_transcript: true,
        url: true,
        format: true,
        transcriber: { select: { name: true } },
        reviewer: { select: { name: true } },
        reviewer_rejected_count: true,
        final_reviewer_rejected_count: true,
      },
      // orderBy: { batch_id: "asc" },
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

export const assignUnassignedTasks = async (
  groupId,
  state,
  taskField,
  userId
) => {
  // const unassignedTasks = await prisma.task.findMany({
  //   where: { group_id: groupId, state, [taskField]: null },
  //   select: {
  //     id: true,
  //     group_id: true,
  //     state: true,
  //     inference_transcript: true,
  //     transcript: true,
  //     reviewed_transcript: true,
  //     final_reviewed_transcript: true,
  //     url: true,
  //     format: true,
  //     transcriber: { select: { name: true } },
  //     reviewer: { select: { name: true } },
  //     reviewer_rejected_count: true,
  //     final_reviewer_rejected_count: true,
  //   },
  //   orderBy: { id: "asc" },
  //   take: ASSIGN_TASKS,
  // });

  const unassignedTasks = await prisma.$queryRaw(
    Prisma.sql`
      WITH ordered_batches AS (
        SELECT DISTINCT 
          batch_id,
          SUBSTRING(batch_id FROM '^[^-]+') as prefix,
          CAST(REGEXP_REPLACE(
            SPLIT_PART(REPLACE(REPLACE(batch_id, 'Correction-', ''), 'Manual-', ''), 'a', 1),
            '[^0-9]',
            '',
            'g'
          ) AS INTEGER) as numeric_part
        FROM "Task"
        WHERE group_id = ${groupId}
          AND state = ${state}::"State"
          AND ${Prisma.raw(taskField)} IS NULL
        ORDER BY 
          prefix ASC,
          numeric_part,
          batch_id
        LIMIT 1
      )
      SELECT 
        t.id,
        t.group_id,
        t.state,
        t.batch_id,
        t.inference_transcript,
        t.transcript,
        t.reviewed_transcript,
        t.final_reviewed_transcript,
        t.url,
        t.format,
        t.reviewer_rejected_count,
        t.final_reviewer_rejected_count,
        tr.name as "transcriber.name",
        r.name as "reviewer.name"
      FROM "Task" t
      LEFT JOIN "User" tr ON t.transcriber_id = tr.id
      LEFT JOIN "User" r ON t.reviewer_id = r.id
      WHERE 
        t.group_id = ${groupId}
        AND t.state = ${state}::"State"
        AND t.${Prisma.raw(taskField)} IS NULL
        AND t.batch_id = (SELECT batch_id FROM ordered_batches)
      LIMIT ${ASSIGN_TASKS}
    `
  );

  if (unassignedTasks.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: unassignedTasks.map((task) => task.id) } },
      data: { [taskField]: userId },
    });
  }

  return unassignedTasks;
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
    revalidatePath("/");
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

  // Add role-specific fields
  switch (role) {
    case "TRANSCRIBER":
      dataToUpdate.transcript =
        changedTask.state === "trashed" ? null : transcript;
      dataToUpdate.submitted_at = new Date().toISOString();
      dataToUpdate.duration = duration;
      break;
    case "REVIEWER":
      dataToUpdate.transcript =
        changedTask.state === "transcribing" ? transcript : task.transcript;
      dataToUpdate.reviewed_transcript =
        changedTask.state === "accepted" ? transcript : null;
      dataToUpdate.reviewed_at = new Date().toISOString();
      dataToUpdate.reviewer_rejected_count =
        changedTask.state === "transcribing"
          ? task.reviewer_rejected_count + 1
          : task.reviewer_rejected_count;
      break;
    case "FINAL_REVIEWER":
      dataToUpdate.reviewed_transcript =
        changedTask.state === "submitted"
          ? transcript
          : task.reviewed_transcript;
      dataToUpdate.final_reviewed_transcript =
        changedTask.state === "finalised" ? transcript : null;
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

    // Assuming revalidatePath is a function to refresh or redirect the page
    revalidatePath("/");
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
