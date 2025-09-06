import React from "react";

const UserReportTable = ({ userTaskRecord }) => {
  function formattedDate(date) {
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <>
      <div className="overflow-x-auto shadow-md sm:rounded-lg w-11/12 md:w-4/5 max-h-[70vh]">
        <table className="table table-auto table-pin-rows">
          {/* head */}
          <thead className="text-gray-700 bg-gray-50">
            <tr>
              <th className="pr-80">Context</th>
              <th>State</th>
              <th>Submitted at</th>
              <th>Reviewed at</th>
            </tr>
          </thead>
          <tbody>
            {userTaskRecord.map((task) => (
              <tr key={task.id}>
                <td className="border-l-4 border-blue-500">
                  <div className="grid gap-2 mb-2">
                    <strong>Original (Diplomatic):</strong>
                    {task.diplomatic_context}
                  </div>
                  {task.corrected_context && (
                    <div className="grid gap-2 mb-2">
                      <strong>Corrected:</strong>
                      {task.corrected_context}
                    </div>
                  )}
                  {task.reviewed_context && (
                    <div className="grid gap-2 mb-2">
                      <strong>Reviewed:</strong>
                      {task.reviewed_context}
                    </div>
                  )}
                  {task.final_reviewed_context && (
                    <div className="grid gap-2 mb-2">
                      <strong>Final:</strong>
                      {task.final_reviewed_context}
                    </div>
                  )}
                </td>
                <td>{task.state}</td>
                <td>
                  {task.submitted_at !== null
                    ? formattedDate(task?.submitted_at)
                    : ""}
                </td>
                <td>
                  {task.reviewed_at !== null
                    ? formattedDate(task?.reviewed_at)
                    : ""}
                </td>
              </tr>
            ))
          </tbody>
        </table>
      </div>
    </>
  );
};

export default UserReportTable;
