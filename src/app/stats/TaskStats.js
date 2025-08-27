"use client";
import React from "react";
import GroupPieChart from "./GroupPieChart";

const TaskStats = ({ groupStatastic }) => {
  return (
    <div className="mt-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {groupStatastic.map((group, index) => (
          <GroupPieChart key={group.id ? group.id : index} group={group} />
        ))}
      </div>
    </div>
  );
};

export default TaskStats;
