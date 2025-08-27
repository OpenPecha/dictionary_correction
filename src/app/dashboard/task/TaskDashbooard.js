import React from "react";
import TaskForm from "./TaskForm";

const TaskDashbooard = async ({ groups }) => {
  return (
    <>
      <TaskForm groups={groups} />
    </>
  );
};

export default TaskDashbooard;
