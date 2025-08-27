import React from "react";
import TaskDashbooard from "./TaskDashbooard";
import { getAllGroup } from "@/model/group";

const Task = async ({ searchParams }) => {
  const groups = await getAllGroup();

  return (
    <>
      <div className="overflow-y-hidden min-h-screen">
        <TaskDashbooard groups={groups} searchParams={searchParams} />
      </div>
    </>
  );
};

export default Task;
