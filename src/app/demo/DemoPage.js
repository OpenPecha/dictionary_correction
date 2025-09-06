"use client";

import React, { useEffect, useRef, useState } from "react";
import AppContext from "@/components/AppContext";
import DemoSidebar from "./DemoSidebar";
import ActionButtons from "@/components/ActionButtons";
import { changeTaskState } from "@/model/action";
import Image from "next/image";

const DemoPage = ({ userDetail, language, tasks, userHistory }) => {
  const [languageSelected, setLanguageSelected] = useState("bo");
  const lang = language[languageSelected];
  const [taskList, setTaskList] = useState(tasks);
  const [historyList, setHistoryList] = useState(userHistory); // {completedTaskCount, totalTaskCount, totalTaskPassed}
  const [correctionText, setCorrectionText] = useState("");
  const [isCorrect, setIsCorrect] = useState(null);
  const audioRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id: userId, group_id: groupId, role } = userDetail;

  useEffect(() => {
    if (taskList?.length) {
      setIsLoading(false);
      const currentTask = taskList[0];
      // Initialize correction text to empty - user hasn't made decision yet
      setCorrectionText("");
      setIsCorrect(null);
    } else {
      setIsLoading(false);
    }
  }, [taskList, role]);

  const updateTaskAndIndex = async (action) => {
    try {
      if (!taskList?.length) return;
      
      const task = taskList[0];
      const { id } = task;
      const updatedTask = { ...task };
      
      // Apply context updates based on role and user's decision
      switch (role) {
        case "TRANSCRIBER":
          updatedTask.is_correct = isCorrect;
          if (isCorrect === true) {
            updatedTask.corrected_context = task.normalised_context;
          } else if (isCorrect === false) {
            updatedTask.corrected_context = correctionText;
          }
          break;
        case "REVIEWER":
          updatedTask.corrected_is_correct = isCorrect;
          if (isCorrect === true) {
            updatedTask.reviewed_context = task.corrected_context;
          } else if (isCorrect === false) {
            updatedTask.reviewed_context = correctionText;
          }
          break;
        case "FINAL_REVIEWER":
          updatedTask.reviewed_is_correct = isCorrect;
          if (isCorrect === true) {
            updatedTask.final_reviewed_context = task.reviewed_context;
          } else if (isCorrect === false) {
            updatedTask.final_reviewed_context = correctionText;
          }
          break;
      }
      
      const changeState = await changeTaskState(updatedTask, role, action);
      // remove the task from the tasklist and add to history
      setTaskList((prev) => prev.filter((task) => task.id !== id));
      setHistoryList((prev) => [
        {
          ...updatedTask,
          state: changeState.state,
          submitted_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (error) {
      throw new Error(error);
    }
  };

  return (
    <>
      <AppContext.Provider
        value={{ languageSelected, setLanguageSelected, lang }}
      >
        <DemoSidebar
          userDetail={userDetail}
          taskList={taskList}
          role={role}
          setTaskList={setTaskList}
          userHistory={historyList}
          setHistoryList={setHistoryList}
        >
          {/* Page content here */}
          <div className="h-full w-full flex flex-col justify-center items-center">
            {isLoading ? (
              <h1 className="font-bold text-md md:text-3xl">loading...</h1>
            ) : taskList?.length ? (
              <>
                {role === "REVIEWER" && (
                  <p className="mt-4 md:mt-10">
                    <strong>{lang.transcriber} : </strong>
                    <span>{taskList[0].transcriber?.name}</span>
                  </p>
                )}
                <div className="w-[90%] my-5 md:my-10">
                  <div className="flex flex-col gap-10 border rounded-md shadow-sm shadow-gray-400 items-center p-4">
                    <div className="w-full space-y-4">
                      <div className="space-y-2">
                        <label className="text-red-500 font-bold">{lang.original}</label>
                        <textarea
                          value={taskList[0]?.diplomatic_context || ""}
                          readOnly
                          className="w-full p-2 border rounded-md bg-gray-50 text-gray-800 resize-none text-4xl"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-green-500 font-bold">{lang.suggested_normalisation}</label>
                        <textarea
                          value={(() => {
                            const currentTask = taskList[0];
                            switch (role) {
                              case "TRANSCRIBER":
                                return currentTask?.normalised_context || "";
                              case "REVIEWER":
                                return currentTask?.corrected_context || "";
                              case "FINAL_REVIEWER":
                                return currentTask?.reviewed_context || "";
                              default:
                                return "";
                            }
                          })()}
                          readOnly
                          className="w-full p-2 border rounded-md bg-gray-50 text-gray-800 resize-none text-4xl"
                          rows={3}
                        />
                      </div>
                      
                      <div className="text-center">
                        <h3 className="text-xl font-bold mb-4">{lang.is_correct_question}</h3>
                        <div className="flex justify-center gap-4 mb-4">
                          <button
                            onClick={() => setIsCorrect(true)}
                            className={`px-8 py-3 rounded-md font-medium ${
                              isCorrect === true
                                ? "bg-green-500 text-white shadow-lg transform scale-105"
                                : "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                            }`}
                          >
                            {lang.yes}
                          </button>
                          <button
                            onClick={() => setIsCorrect(false)}
                            className={`px-8 py-3 rounded-md font-medium ${
                              isCorrect === false
                                ? "bg-red-500 text-white shadow-lg transform scale-105"
                                : "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                            }`}
                          >
                            {lang.no}
                          </button>
                        </div>
                      </div>
                      
                      {isCorrect === false && (
                        <div className="space-y-2">
                          <label className="font-medium text-gray-700">{lang.correction_prompt}</label>
                          <textarea
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            className="w-full p-3 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-4xl"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <ActionButtons
                  updateTaskAndIndex={updateTaskAndIndex}
                  tasks={taskList}
                  role={role}
                />
              </>
            ) : (
              <div className="flex flex-col justify-center items-center mt-10 p-5">
                <h1 className="font-bold text-lg md:text-3xl">
                  No task found, will allocate soon
                </h1>
              </div>
            )}
          </div>
        </DemoSidebar>
      </AppContext.Provider>
    </>
  );
};

export default DemoPage;
