"use client";

import {
  getTasksOrAssignMore,
  prefetchNextTaskBatch,
  updateTask,
} from "@/model/action";
import React, { useState, useRef, useEffect, useCallback } from "react";

import { UserProgressStats } from "@/model/task";
import Sidebar from "@/components/Sidebar";
import toast from "react-hot-toast";
import AppContext from "./AppContext";

const PREFETCH_THRESHOLD = 3;

const TaskView = ({ tasks, userDetail, language, userHistory }) => {
  const [languageSelected, setLanguageSelected] = useState("bo");
  const lang = language[languageSelected];
  const [taskList, setTaskList] = useState(tasks);
  const [userTaskStats, setUserTaskStats] = useState({
    completedTaskCount: 0,
    totalTaskCount: 0,
    totalTaskPassed: 0,
  }); // {completedTaskCount, totalTaskCount, totalTaskPassed}
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const { id: userId, group_id: groupId, role } = userDetail;
  const currentTimeRef = useRef(null);
  const prefetchPromiseRef = useRef(null);
  const isPrefetchingRef = useRef(false);

  const getContextValues = () => {
    if (!taskList?.length) return { firstContext: "", secondContext: "" };
    const currentTask = taskList[0];
    switch (role) {
      case "TRANSCRIBER":
        return {
          firstContext: currentTask?.diplomatic_context || "",
          secondContext: currentTask?.normalised_context || "",
        };
      case "REVIEWER":
        return {
          firstContext: currentTask?.diplomatic_context || "",
          secondContext: currentTask?.corrected_context || "",
        };
      case "FINAL_REVIEWER":
        return {
          firstContext: currentTask?.diplomatic_context || "",
          secondContext: currentTask?.reviewed_context || "",
        };
      default:
        return { firstContext: "", secondContext: "" };
    }
  };

  const getUserProgress = useCallback(async () => {
    const { completedTaskCount, totalTaskCount, totalTaskPassed } =
      await UserProgressStats(userId, role, groupId);
    setUserTaskStats({
      completedTaskCount,
      totalTaskCount,
      totalTaskPassed,
    });
  }, [userId, role, groupId]);

  const ensurePrefetch = useCallback(() => {
    if (isPrefetchingRef.current || prefetchPromiseRef.current) {
      return prefetchPromiseRef.current;
    }
    isPrefetchingRef.current = true;
    prefetchPromiseRef.current = prefetchNextTaskBatch(groupId, userId, role)
      .catch((error) => {
        console.error("Failed to prefetch next task batch:", error);
        return [];
      })
      .finally(() => {
        isPrefetchingRef.current = false;
      });
    return prefetchPromiseRef.current;
  }, [groupId, userId, role]);

  useEffect(() => {
    getUserProgress();
    // Assign a value to currentTimeRef.current
    currentTimeRef.current = new Date().toISOString();
    if (taskList?.length) {
      setIsLoading(false);
      const currentTask = taskList[0];
      switch (role) {
        case "TRANSCRIBER":
          setIsCorrect(null); // Reset to null, will be set by user interaction
          setCorrectionText(currentTask?.corrected_context || "");
          break;
        case "REVIEWER":
          setIsCorrect(null); // Reset to null, will be set by user interaction
          setCorrectionText(currentTask?.reviewed_context || "");
          break;
        case "FINAL_REVIEWER":
          setIsCorrect(null); // Reset to null, will be set by user interaction
          setCorrectionText(currentTask?.final_reviewed_context || "");
          break;
        default:
          break;
      }

      // Prefetch next batch before the queue empties so the last submit stays snappy
      if (taskList.length <= PREFETCH_THRESHOLD && !prefetchPromiseRef.current) {
        ensurePrefetch();
      }
    } else {
      setIsLoading(false);
    }
  }, [taskList, role, getUserProgress, ensurePrefetch]);

  const validateSubmission = () => {
    // User must select either YES or NO
    if (isCorrect === null) {
      return {
        isValid: false,
        message:
          lang.validation_select_option ||
          "Please select YES or NO before submitting.",
      };
    }

    // If user selected NO, they must provide correction text
    if (isCorrect === false && correctionText.trim() === "") {
      return {
        isValid: false,
        message:
          lang.validation_correction_required ||
          "Please provide the normalized form when selecting NO.",
      };
    }

    return { isValid: true, message: "" };
  };

  const applyRoleBusinessLogic = (action, currentTask) => {
    const updatedTask = { ...currentTask };

    if (action !== "submit" && action !== "reject" && action !== "trash") {
      return updatedTask;
    }

    switch (role) {
      case "TRANSCRIBER":
        updatedTask.is_correct = isCorrect;
        // Business rule: If YES → use normalised_context, If NO → use correctionText
        if (isCorrect === true) {
          updatedTask.corrected_context = currentTask.normalised_context;
        } else if (isCorrect === false) {
          updatedTask.corrected_context = correctionText;
        }
        break;
      case "REVIEWER":
        updatedTask.corrected_is_correct = isCorrect;
        // Business rule: If YES → use corrected_context, If NO → use correctionText
        if (isCorrect === true) {
          updatedTask.reviewed_context = currentTask.corrected_context;
        } else if (isCorrect === false) {
          updatedTask.reviewed_context = correctionText;
        }
        break;
      case "FINAL_REVIEWER":
        updatedTask.reviewed_is_correct = isCorrect;
        // Business rule: If YES → use reviewed_context, If NO → use correctionText
        if (isCorrect === true) {
          updatedTask.final_reviewed_context = currentTask.reviewed_context;
        } else if (isCorrect === false) {
          updatedTask.final_reviewed_context = correctionText;
        }
        break;
      default:
        break;
    }

    return updatedTask;
  };

  const loadNextBatch = async () => {
    setIsLoading(true);
    try {
      let moreTasks = [];
      if (prefetchPromiseRef.current) {
        moreTasks = await prefetchPromiseRef.current;
        prefetchPromiseRef.current = null;
      }
      if (!moreTasks?.length) {
        moreTasks = await getTasksOrAssignMore(groupId, userId, role);
      }
      setTaskList(moreTasks || []);
    } catch (error) {
      console.error("Failed to load next task batch:", error);
      toast.error("Failed to load next tasks. Please refresh.");
      setTaskList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskAndIndex = async (action) => {
    if (isSubmitting) {
      return;
    }

    // Validate before submission
    if (action === "submit") {
      const validation = validateSubmission();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }
    }

    if (!taskList?.length) {
      return;
    }

    const currentTask = taskList[0];
    const { id } = currentTask;
    const remainingTasks = taskList.slice(1);
    const updatedTask = applyRoleBusinessLogic(action, currentTask);
    const submitTime = currentTimeRef.current;

    setIsSubmitting(true);

    // Optimistic UI: advance to the next task immediately; persist in background
    if (remainingTasks.length > 0) {
      setTaskList(remainingTasks);
      if (action === "submit") {
        currentTimeRef.current = new Date().toISOString();
      }
    } else {
      // Last task in queue — show loading while we take the prefetched/assigned batch
      setIsLoading(true);
    }

    try {
      const { msg, error } = await updateTask(
        action,
        id,
        "", // transcript not used anymore
        updatedTask,
        role,
        submitTime
      );

      if (error || msg?.error) {
        // Roll back optimistic removal so the user can retry
        setTaskList((prev) => [currentTask, ...prev]);
        setIsLoading(false);
        toast.error(error || msg.error);
        return;
      }

      toast.success(msg.success);

      if (action === "submit") {
        getUserProgress();
      }

      if (remainingTasks.length === 0) {
        await loadNextBatch();
      } else if (remainingTasks.length <= PREFETCH_THRESHOLD) {
        ensurePrefetch();
      }
    } catch (error) {
      setTaskList((prev) => [currentTask, ...prev]);
      setIsLoading(false);
      toast.error("Failed to update task. Please try again.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppContext.Provider
      value={{ languageSelected, setLanguageSelected, lang }}
    >
      <Sidebar
        userDetail={userDetail}
        userTaskStats={userTaskStats}
        taskList={taskList}
        role={role}
        setTaskList={setTaskList}
        userHistory={userHistory}
        updateTaskAndIndex={updateTaskAndIndex}
        isSubmitting={isSubmitting}
      >
        {/* Page content here */}
        <div className="w-full flex flex-col justify-center items-center">
          {isLoading ? (
            <h1 className="font-bold text-md md:text-3xl">loading...</h1>
          ) : taskList?.length ? (
            <>
              {(role === "REVIEWER" || role === "FINAL_REVIEWER") && (
                <div>
                  <p className="mt-4 md:mt-10 text-black">
                    <strong>{lang.transcriber} : </strong>
                    <span>
                      {taskList[0]?.transcriber
                        ? taskList[0].transcriber?.name
                        : taskList[0]["transcriber.name"]}
                    </span>
                  </p>
                  {role === "FINAL_REVIEWER" && (
                    <p className="mt-2 text-black">
                      <strong>{lang.reviewer} : </strong>
                      <span>
                        {taskList[0]?.reviewer
                          ? taskList[0]?.reviewer?.name
                          : taskList[0]["reviewer.name"]}
                      </span>
                    </p>
                  )}
                </div>
              )}
              <div className="w-[90%] my-5 md:my-10">
                <div className="flex flex-col gap-10 border rounded-md shadow-sm shadow-gray-400 items-center p-4">
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <label className="text-red-500 font-bold">
                        {lang.original}
                      </label>
                      <textarea
                        value={getContextValues().firstContext}
                        readOnly
                        className="w-full p-2 border rounded-md bg-gray-50 text-gray-800 resize-none text-4xl"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-green-500 font-bold">
                        {lang.suggested_normalisation}
                      </label>
                      <textarea
                        value={getContextValues().secondContext}
                        readOnly
                        className="w-full p-2 border rounded-md bg-gray-50 text-gray-800 resize-none text-4xl"
                        rows={3}
                      />
                    </div>

                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-4">
                        {lang.is_correct_question}
                      </h3>
                      <div className="flex justify-center gap-4 mb-4">
                        <button
                          onClick={() => setIsCorrect(true)}
                          disabled={isSubmitting}
                          className={`px-8 py-3 rounded-md font-medium ${
                            isCorrect === true
                              ? "bg-green-500 text-white shadow-lg transform scale-105"
                              : "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                          } disabled:opacity-60`}
                        >
                          {lang.yes}
                        </button>
                        <button
                          onClick={() => setIsCorrect(false)}
                          disabled={isSubmitting}
                          className={`px-8 py-3 rounded-md font-medium ${
                            isCorrect === false
                              ? "bg-red-500 text-white shadow-lg transform scale-105"
                              : "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                          } disabled:opacity-60`}
                        >
                          {lang.no}
                        </button>
                      </div>
                    </div>

                    {isCorrect === false && (
                      <div className="space-y-2">
                        <label className="font-medium text-gray-700">
                          {lang.correction_prompt}
                        </label>
                        <p className="text-sm text-blue-600 font-medium italic">
                          {lang.correction_instruction}
                        </p>
                        <textarea
                          value={correctionText}
                          onChange={(e) => setCorrectionText(e.target.value)}
                          disabled={isSubmitting}
                          className="w-full p-3 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-4xl text-black disabled:opacity-60"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-center items-center mt-10 p-5">
              <h1 className="font-bold text-lg md:text-3xl">
                No task found, will allocate soon
              </h1>
            </div>
          )}
        </div>
      </Sidebar>
    </AppContext.Provider>
  );
};

export default TaskView;
