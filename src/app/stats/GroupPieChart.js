"use client";
import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const GroupPieChart = ({ group }) => {
  //console.log("GroupPieChart:::", group);
  const {
    taskTranscribingCount,
    taskSubmittedCount,
    taskAcceptedCount,
    taskFinalisedCount,
    taskTrashedCount,
  } = group;
  const data = {
    labels: ["Transcribing", "Submitted", "Accepted", "Finalised", "Trashed"],
    datasets: [
      {
        label: "Task Count",
        data: [
          taskTranscribingCount,
          taskSubmittedCount,
          taskAcceptedCount,
          taskFinalisedCount,
          taskTrashedCount,
        ],
        backgroundColor: ["blue", "yellow", "green", "purple", "red"],
        borderColor: ["blue", "yellow", "green", "purple", "red"],
        borderWidth: 1,
      },
    ],
  };

  return (
    <>
      <div className="p-5">
        <Pie
          className="w-full h-full"
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "top",
              },
              title: {
                display: true,
                text: `${group.name ? group.name : ""}`,
                color: "red",
                font: {
                  size: 20,
                },
              },
            },
          }}
        ></Pie>
      </div>
    </>
  );
};

export default GroupPieChart;
