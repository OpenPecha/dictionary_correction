import { getAllGroup, getAllGroupTaskStats } from "@/model/group";
import React from "react";
import GroupTaskStats from "./GroupTaskStats";
import TaskStats from "./TaskStats";
export const dynamic = "force-dynamic";

const Stats = async () => {
  const allGroup = await getAllGroup();
  const groupStatastic = await getAllGroupTaskStats(allGroup);

  return (
    <>
      {groupStatastic && groupStatastic.length > 0 && (
        <div className="m-5 md:m-10">
          <div className="text-xl md:text-2xl text-center font-bold">
            Group transcribing state count.
          </div>
          <GroupTaskStats groupStatastic={groupStatastic} />
          <TaskStats groupStatastic={groupStatastic} />
        </div>
      )}
    </>
  );
};

export default Stats;
