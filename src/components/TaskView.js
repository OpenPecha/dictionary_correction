"use client";

import { getTasksOrAssignMore, updateTask } from "@/model/action";
import React, { useState, useRef, useEffect } from "react";

import { UserProgressStats } from "@/model/task";
import Sidebar from "@/components/Sidebar";
import toast from "react-hot-toast";
import AppContext from "./AppContext";


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
  const [isCorrect, setIsCorrect] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const { id: userId, group_id: groupId, role } = userDetail;
  const currentTimeRef = useRef(null);

  function getLastTaskIndex() {
    return taskList.length != 0 ? taskList?.length - 1 : 0;
  }

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

  useEffect(() => {
    getUserProgress();
    // Assign a value to currentTimeRef.current
    currentTimeRef.current = new Date().toISOString();
    if (taskList?.length) {
      setIsLoading(false);
      const currentTask = taskList[0];
      switch (role) {
        case "TRANSCRIBER":
          setIsCorrect(currentTask?.is_correct);
          setCorrectionText(currentTask?.corrected_context || "");
          break;
        case "REVIEWER":
          setIsCorrect(currentTask?.corrected_is_correct);
          setCorrectionText(currentTask?.reviewed_context || "");
          break;
        case "FINAL_REVIEWER":
          setIsCorrect(currentTask?.reviewed_is_correct);
          setCorrectionText(currentTask?.final_reviewed_context || "");
        default:
          break;
      }
    } else {
      setIsLoading(false);
    }
  }, [taskList]);

  const getUserProgress = async () => {
    const { completedTaskCount, totalTaskCount, totalTaskPassed } =
      await UserProgressStats(userId, role, groupId);
    setUserTaskStats({
      completedTaskCount,
      totalTaskCount,
      totalTaskPassed,
    });
  };



  const updateTaskAndIndex = async (action) => {
    try {
      const { id } = taskList[0];
      const updatedTask = { ...taskList[0] };
      
      // Update the correct fields based on role
      switch (role) {
        case "TRANSCRIBER":
          updatedTask.is_correct = isCorrect;
          updatedTask.corrected_context = correctionText;
          break;
        case "REVIEWER":
          updatedTask.corrected_is_correct = isCorrect;
          updatedTask.reviewed_context = correctionText;
          break;
        case "FINAL_REVIEWER":
          updatedTask.reviewed_is_correct = isCorrect;
          updatedTask.final_reviewed_context = correctionText;
          break;
      }
      
      // update the task in the database
      const { msg } = await updateTask(
        action,
        id,
        "", // transcript not used anymore
        updatedTask,
        role,
        currentTimeRef.current
      );
      
      if (msg?.error) {
        toast.error(msg.error);
      } else {
        toast.success(msg.success);
      }
      
      if (action === "submit") {
        getUserProgress();
      }
      
      if (getLastTaskIndex() != 0) {
        // remove the task updated from the task list
        setTaskList((prev) => prev.filter((task) => task.id !== id));
        if (action === "submit") {
          currentTimeRef.current = new Date().toISOString();
        }
      } else {
        // when it is the last task in the task list
        const moreTask = await getTasksOrAssignMore(groupId, userId, role);
        setIsLoading(true);
        setTaskList(moreTask);
      }
    } catch (error) {
      throw new Error(error);
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
                      <label className="text-red-500 font-bold">Original:</label>
                      <textarea
                        value={getContextValues().firstContext}
                        readOnly
                        className="w-full p-2 border rounded-md bg-gray-50 text-gray-800 resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-green-500 font-bold">Suggested normalisation:</label>
                      <textarea
                        value={getContextValues().secondContext}
                        readOnly
                        className="w-full p-2 border rounded-md bg-gray-50 text-gray-800 resize-none"
                        rows={3}
                      />
                    </div>
                    
                    <div className="text-center">
                      <h3 className="text-xl font-bold mb-4">Is the suggested normalisation correct?</h3>
                      <div className="flex justify-center gap-4 mb-4">
                        <button
                          onClick={() => setIsCorrect(true)}
                          className={`px-8 py-3 rounded-md font-medium ${
                            isCorrect === true
                              ? "bg-green-500 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-green-100"
                          }`}
                        >
                          YES
                        </button>
                        <button
                          onClick={() => setIsCorrect(false)}
                          className={`px-8 py-3 rounded-md font-medium ${
                            isCorrect === false
                              ? "bg-red-500 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-red-100"
                          }`}
                        >
                          NO
                        </button>
                      </div>
                    </div>
                    
                    {isCorrect === false && (
                      <div className="space-y-2">
                        <label className="font-medium text-gray-700">If not, what should be the normalisation?</label>
                        <textarea
                          value={correctionText}
                          onChange={(e) => setCorrectionText(e.target.value)}
                          placeholder="text box to type a line"
                          className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                      </div>
                    )}
                    
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={() => updateTaskAndIndex("submit")}
                        disabled={isCorrect === null}
                        className={`px-8 py-3 rounded-md font-medium ${
                          isCorrect === null
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
                      >
                        Submit
                      </button>
                    </div>
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
