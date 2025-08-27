"use server";

import prisma from "@/service/db";
import { revalidatePath } from "next/cache";
import {
  getFinalReviewerTaskCount,
  getReviewerTaskCount,
  getReviewerTaskList,
  getReviewedTaskCountBasedOnSubmittedAt,
  getTranscriberTaskList,
  getUserSpecificTasksCount,
  getFinalisedTaskCount,
} from "./task";

const levenshtein = require("fast-levenshtein");

export const getAllUser = async () => {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            transcriber_task: true,
            reviewer_task: true,
            final_reviewer_task: true,
          },
        },
        group: true,
      },
      orderBy: {
        id: "asc",
      },
    });
    return users;
  } catch (error) {
    console.error("Failed to retrieve users:", error);
    throw new Error("Failed to retrieve users.");
  }
};

export const createUser = async (formData) => {
  const name = formData.get("name");
  const email = formData.get("email");
  const groupId = formData.get("group_id");
  const role = formData.get("role");
  try {
    // check if username  and email already exists
    const userByName = await prisma.user.findUnique({
      where: {
        name: name,
      },
    });

    const userByEmail = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (userByName && userByEmail) {
      return {
        error: "User already exists with the same username and email",
      };
    } else if (userByName) {
      return {
        error: "User already exists with the same username",
      };
    } else if (userByEmail) {
      return {
        error: "User already exists with the same email",
      };
    }
    // If no matching user was found, you can proceed with user creating new user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        group_id: parseInt(groupId),
        role,
      },
    });
    revalidatePath("/dashboard/user");
    // if new user is created, send msg to client side that user is created
    if (newUser) {
      return {
        success: "User created successfully",
      };
    } else {
      return {
        error: "Error creating user",
      };
    }
  } catch (error) {
    //console.log("Error adding a user", error);
    throw new Error(error);
  }
};

export const deleteUser = async (id) => {
  try {
    const user = await prisma.user.delete({
      where: {
        id,
      },
    });
    revalidatePath("/dashboard/user");
    return { success: "User deleted successfully" };
  } catch (error) {
    console.log("Failed to delete the user:", error);
    throw new Error("Failed to delete the user.");
  }
};

export const editUser = async (id, formData) => {
  const name = formData.get("name");
  const email = formData.get("email");
  const groupId = formData.get("group_id");
  const role = formData.get("role");
  try {
    // check if username  and email already exists
    const userId = parseInt(id); // Ensure id is converted to an integer
    const userByName = await prisma.user.findUnique({
      where: {
        name: name,
        NOT: {
          id: userId,
        },
      },
    });

    const userByEmail = await prisma.user.findUnique({
      where: {
        email: email,
        NOT: {
          id: userId,
        },
      },
    });

    if (userByName && userByEmail) {
      return {
        error: "User already exists with the same username and email",
      };
    } else if (userByName) {
      return {
        error: "User already exists with the same username",
      };
    } else if (userByEmail) {
      return {
        error: "User already exists with the same email",
      };
    }
    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: {
        name,
        email,
        group_id: parseInt(groupId),
        role,
      },
    });
    revalidatePath("/dashboard/user");
    // if user data is edited , send msg to client side that user is created
    if (updatedUser) {
      return {
        success: "User edited successfully",
      };
    } else {
      return {
        error: "Error editing user",
      };
    }
  } catch (error) {
    console.log("Failed to update the user details:", error);
    throw new Error("Failed to update the user details.");
  }
};

export const getUsersByGroup = async (groupId) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        group_id: parseInt(groupId),
        role: "TRANSCRIBER",
      },
    });
    return users;
  } catch (error) {
    console.error("Failed to retrieve users by group:", error);
    throw new Error("Failed to retrieve users by group.");
  }
};

// when removed from the UI,
//     IT should not delete the USER data from the DB but remove from the UI.
// but
//     It should check the USER's role
//     and then check the state of the task as per USRER role
//     if the task is not done according to the role then assign the role_id null
//     so that it can be assigned to someone else from the same group.
export const removeUser = async (user) => {
  const { id: userId, role, name, email } = user;
  // Check for associated tasks
  const userConstraintCount = await prisma.task.count({
    where: {
      OR: [
        { transcriber_id: userId },
        { reviewer_id: userId },
        { final_reviewer_id: userId },
      ],
    },
  });
  if (userConstraintCount === 0) {
    return deleteUser(userId);
  }

  // use prisma transaction to delete the user and update the task
  try {
    const [updatedUser, updatedTask] = await prisma.$transaction([
      prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name: `removed_${name}`,
          email: `removed_${email}`,
        },
      }),
      prisma.task.updateMany({
        // lowercase the role to match the column name in the task table
        where: {
          [`${role.toLowerCase()}_id`]: userId,
          state:
            role === "TRANSCRIBER"
              ? "transcribing"
              : role === "REVIEWER"
              ? "submitted"
              : "accepted",
        },
        data: {
          [`${role.toLowerCase()}_id`]: null,
        },
      }),
    ]);
    const updatedTaskCount = updatedTask.count;
    revalidatePath("/dashboard/user");
    return {
      success: `User removed successfully and updated ${updatedTaskCount} tasks `,
    };
  } catch (error) {
    console.error("Error removing a user", error);
    throw new Error("Failed to remove user.");
  }
};

export const generateUserReportByGroup = async (groupId, dates) => {
  try {
    const users = await getUsersByGroup(groupId);
    // if user is not found, return empty array
    if (!users) {
      return [];
    }
    const usersStatistic = await Promise.all(
      users.map((user) => generateUsersTaskReport(user, dates, groupId))
    );
    return usersStatistic;
  } catch (error) {
    console.error("Error generating transcriber report by group:", error);
    throw new Error("Failed to generate transcriber report.");
  }
};

export const generateUsersTaskReport = async (user, dates, groupId) => {
  const { id: userId, name } = user;
  const [
    submittedTaskCount,
    userTasks,
    submittedAtReviewedCount,
    finalisedCount,
  ] = await Promise.all([
    getUserSpecificTasksCount(userId, dates, groupId),
    getTranscriberTaskList(userId, dates, groupId),
    getReviewedTaskCountBasedOnSubmittedAt(userId, dates, groupId),
    getFinalisedTaskCount(userId, dates, groupId),
  ]);

  const transcriberObj = {
    id: userId,
    name,
    noSubmitted: submittedTaskCount,
    noReviewedBasedOnSubmitted: submittedAtReviewedCount || 0,
    noReviewed: 0,
    noFinalised: finalisedCount || 0,
    noTranscriptCorrected: 0,
    characterCount: 0,
    cer: 0,
    totalCer: 0,
    inferenceTotalCer: 0,
    inferenceTotalCharacterCount: 0,
  };

  const updatedTranscriberObj = await UserTaskReport(transcriberObj, userTasks);

  return updatedTranscriberObj;
};

// get the task statistics - task reviewed, reviewed secs, syllable count
export const UserTaskReport = (transcriberObj, userTasks) => {
  const userTaskSummary = userTasks.reduce((acc, task) => {
    // check if the inference transcript is not null
    if (task.inference_transcript && task.transcript) {
      acc.inferenceTotalCharacterCount += task.inference_transcript
        ? task.inference_transcript?.length
        : 0;
      const cer = levenshtein.get(task.inference_transcript, task.transcript);
      acc.inferenceTotalCer += cer; // Add CER for each task to total
    }
    if (["accepted", "finalised"].includes(task.state)) {
      acc.noReviewed++;
      acc.characterCount += task.transcript ? task.transcript?.length : 0;
      // Ensure both transcripts are available before calculating CER
      if (task.transcript && task.reviewed_transcript) {
        const cer = levenshtein.get(task.transcript, task.reviewed_transcript);
        acc.totalCer += cer; // Add CER for each task to total
      }
      if (task.transcript !== task.reviewed_transcript) {
        acc.noTranscriptCorrected++;
      }
    }
    return acc;
  }, transcriberObj);
  return userTaskSummary;
};

export const reviewerOfGroup = async (groupId) => {
  try {
    const reviewers = await prisma.user.findMany({
      where: {
        group_id: parseInt(groupId),
        role: "REVIEWER",
      },
    });
    return reviewers;
  } catch (error) {
    console.error("Error getting reviewers of group:", error);
    throw new Error(error);
  }
};

// for all the reviewers of a group retun the task statistics - task reviewed, task accepted, task finalised
export const generateReviewerReportbyGroup = async (groupId, dates) => {
  try {
    const reviewers = await reviewerOfGroup(groupId);
    const reviewersReport = await Promise.all(
      reviewers.map((reviewer) => generateReviewerTaskReport(reviewer, dates))
    );

    return reviewersReport;
  } catch (error) {
    console.error("Error getting users by group:", error);
    throw new Error(error);
  }
};

export const generateReviewerTaskReport = async (reviewer, dates) => {
  const { id, name } = reviewer;

  const [reviewerStats, reviewerTasks] = await Promise.all([
    getReviewerTaskCount(id, dates),
    getReviewerTaskList(id, dates),
  ]);

  const reviewerObj = {
    id,
    name,
    noReviewed: reviewerStats.noReviewed,
    noAccepted: reviewerStats.noAccepted,
    noFinalised: reviewerStats.noFinalised,
    noRejected: reviewerStats.noRejected,
    noReviewedTranscriptCorrected: 0,
    cer: 0,
    totalCer: 0,
    characterCount: 0,
  };

  // const updatedReviwerObj = await getReviewerTaskCount(id, dates, reviewerObj);
  const updatedReviewerObj = await moreReviewerStats(
    reviewerObj,
    reviewerTasks
  );

  return updatedReviewerObj;
};

export const moreReviewerStats = (reviewerObj, reviewerTasks) => {
  const reviewerTaskSummary = reviewerTasks.reduce((acc, task) => {
    if (task.reviewed_transcript && task.final_reviewed_transcript) {
      if (task.reviewed_transcript !== task.final_reviewed_transcript) {
        acc.noReviewedTranscriptCorrected++;
      }
      acc.characterCount += task.reviewed_transcript
        ? task.reviewed_transcript.length
        : 0;
      const cer = levenshtein.get(
        task.reviewed_transcript,
        task.final_reviewed_transcript
      );
      acc.totalCer += cer; // Add CER for each task to total
    }
    return acc;
  }, reviewerObj);
  return reviewerTaskSummary;
};

// for all the final reviewers of a group retun the task statistics - task finalised, finalised mintues
export const generateFinalReviewerReportbyGroup = async (groupId, dates) => {
  try {
    const finalReviewers = await finalReviewerOfGroup(groupId);
    const usersReport = generateFinalReviewerTaskReport(finalReviewers, dates);
    return usersReport;
  } catch (error) {
    console.error("Error getting users by group:", error);
    throw new Error(error);
  }
};

export const finalReviewerOfGroup = async (groupId) => {
  try {
    const finalReviewers = await prisma.user.findMany({
      where: {
        group_id: parseInt(groupId),
        role: "FINAL_REVIEWER",
      },
    });
    return finalReviewers;
  } catch (error) {
    console.error("Error getting final reviewers of group:", error);
    throw new Error(error);
  }
};

export const generateFinalReviewerTaskReport = async (
  finalReviewers,
  dates
) => {
  const finalReviewerList = [];

  for (const finalReviewer of finalReviewers) {
    const { id, name } = finalReviewer;

    const finalReviewerObj = {
      id,
      name,
      noFinalised: 0,
      noRejected: 0,
    };

    const updatedFinalReviwerObj = await getFinalReviewerTaskCount(
      id,
      dates,
      finalReviewerObj
    );
    finalReviewerList.push(updatedFinalReviwerObj);
  }
  return finalReviewerList;
};
