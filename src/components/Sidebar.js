import React from "react";
import AppContext from "./AppContext";
import { useContext } from "react";
import LanguageToggle from "./LanguageToggle";
import { BsCheckLg } from "react-icons/bs";
import { getTaskWithRevertedState } from "@/model/task";
import Link from "next/link";
import ActionButtons from "./ActionButtons";
import RightSidebar from "@/components/RightSidebar";
import { AiOutlineStop } from "react-icons/ai";
import TranscriptDisplay from "@/components/TranscriptDisplay";

const Sidebar = ({
  children,
  userDetail,
  userTaskStats,
  taskList,
  role,
  setTaskList,
  userHistory,
  updateTaskAndIndex,
  transcript,
}) => {
  const { completedTaskCount, totalTaskCount, totalTaskPassed } = userTaskStats;
  const value = useContext(AppContext);
  let { lang, languageSelected } = value;

  const handleHistoryClick = async (task) => {
    // get the task from db with task state step down by 1
    // if it is not, just push the new task to the top
    const newTask = await getTaskWithRevertedState(task, role);
    setTaskList([newTask, ...taskList]);
    return;
  };

  return (
    <>
      <div
        className={`drawer lg:drawer-open ${
          languageSelected === "bo" && "font-OuChan text-lg"
        }`}
      >
        <input id="my-drawer-3" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex flex-col items-center bg-white">
          {/* Navbar */}
          <div className="w-full navbar text-white bg-[#384451] lg:hidden">
            <div className="flex-none lg:hidden">
              <label htmlFor="my-drawer-3" className="btn btn-square btn-ghost">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-6 h-6 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  ></path>
                </svg>
              </label>
            </div>
            <div className="flex-1 px-2 mx-2">{lang.title}</div>
          </div>
          {children}
        </div>
        <div className="drawer-side">
          <label htmlFor="my-drawer-3" className="drawer-overlay"></label>
          <div className="flex flex-col w-80 min-h-full h-full text-white mb-10 bg-[#54606e]">
            <header className="bg-[#384451] py-2 px-4">
              <div className="text-lg">{lang.title}</div>
            </header>
            <section className="px-4 py-4 border-b border-b-[#384451] flex">
              <ActionButtons
                updateTaskAndIndex={updateTaskAndIndex}
                tasks={taskList}
                transcript={transcript}
                role={role}
              />
              <RightSidebar>
                <iframe
                  className="w-full h-full"
                  src="https://docs.google.com/spreadsheets/d/e/2PACX-1vT5gDbwko0iKrR46GjJgsmMgGQXc6EiC9xBugl8BvV66pPz-czBeyO1DfVsti0jg-EJqTZ7dSUCu_qC/pubhtml?gid=991898896&amp;single=true&amp;widget=true&amp;headers=false"
                ></iframe>
              </RightSidebar>
            </section>
            <section className="px-4 py-4 border-b border-b-[#384451]">
              <h3 className="uppercase font-bold mb-2">{lang.project}</h3>
              <div className="flex justify-between">
                <label className="text-sm font-bold mb-2">{lang.user}</label>
                <span className="text-right">{userDetail.name}</span>
              </div>
              <div className="flex justify-between">
                <label className="text-sm font-bold mb-2">{lang.group}</label>
                <span className="text-right">{userDetail.group.name}</span>
              </div>
              <div className="flex justify-between w-full">
                <label className="text-sm font-bold mb-2 w-1/2">
                  {lang.task}
                </label>
                <span className="overflow-scroll text-right">
                  {taskList[0]?.id}
                </span>
              </div>
            </section>
            <section className="px-4 py-4 border-b border-b-[#384451]">
              <h3 className="uppercase font-bold mb-2">{lang.target}</h3>
              <div
                className="tooltip tooltip-bottom w-full mt-2 mb-6"
                data-tip={`${completedTaskCount}/${totalTaskCount}`}
              >
                <progress
                  className="progress progress-success"
                  value={completedTaskCount}
                  max={totalTaskCount}
                ></progress>
              </div>
              <div
                className="tooltip tooltip-top flex text-right justify-between"
                data-tip={
                  role === "TRANSCRIBER"
                    ? "No. of task submitted by you"
                    : role === "REVIEWER"
                    ? "No. of task reviewed by you"
                    : "No. of task finalised by you"
                }
              >
                <label className=" text-sm font-bold mb-2">
                  {role === "TRANSCRIBER"
                    ? lang.submitted
                    : role === "REVIEWER"
                    ? lang.reviewed
                    : lang.final_reviewed}
                </label>
                <span className="text-right">{completedTaskCount}</span>
              </div>
              {(role === "TRANSCRIBER" || role === "REVIEWER") && (
                <div
                  className="tooltip tooltip-top flex text-right justify-between"
                  data-tip={
                    role === "TRANSCRIBER"
                      ? "No. of task reviewed by reviewer"
                      : role === "REVIEWER"
                      ? "No. of task finalised by final reviewer"
                      : ""
                  }
                >
                  <label className="text-sm font-bold mb-2">
                    {role === "TRANSCRIBER"
                      ? lang.reviewed
                      : role === "REVIEWER"
                      ? lang.final_reviewed
                      : ""}
                  </label>
                  <span className="text-right">{totalTaskPassed}</span>
                </div>
              )}
              <div
                className="tooltip tooltip-top flex text-right justify-between"
                data-tip={
                  role === "TRANSCRIBER" || role === "REVIEWER"
                    ? "No. of task assigned to you"
                    : "No. of task accepted"
                }
              >
                <label className="text-sm font-bold mb-2">
                  {role === "TRANSCRIBER" || role === "REVIEWER"
                    ? lang.total_assigned
                    : "Total Accepted"}
                </label>
                <span className=" text-right">{totalTaskCount}</span>
              </div>
            </section>
            <section className="px-4 py-3 border-b border-b-[#384451] flex gap-2">
              <h3 className="uppercase font-bold mb-2">{lang.language}</h3>
              <LanguageToggle />
            </section>
            {role === "FINAL_REVIEWER" && (
              <section className="px-4 py-3 border-b border-b-[#384451]">
                <Link
                  href={`/dashboard/?session=${userDetail?.email}`}
                  type="button"
                  className="btn btn-accent btn-wide"
                >
                  Dashboard
                </Link>
              </section>
            )}
            <section className="px-4 py-3 border-b border-b-[#384451] overflow-y-auto flex-1">
              <h3 className="uppercase font-bold pb-2 top-0 sticky">
                {lang.history}
              </h3>
              {userHistory.map((task) => (
                <div
                  key={task.id}
                  className="py-4 cursor-pointer flex justify-between gap-1 items-center border-b-2 border-b-[#384451]"
                  onClick={() => handleHistoryClick(task)}
                >
                  <TranscriptDisplay task={task} role={role} />
                  <div
                    className="tooltip tooltip-left"
                    data-tip={`${task.state}`}
                  >
                    {(task.state === "submitted" ||
                      task.state === "accepted") && <BsCheckLg size="1rem" />}
                    {task.state === "trashed" && <AiOutlineStop size="1rem" />}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
