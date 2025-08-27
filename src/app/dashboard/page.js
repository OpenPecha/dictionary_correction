import React from "react";
import Link from "next/link";

const Dashboard = async () => {
  let routes = ["group", "user"];

  return (
    <div className="h-screen flex flex-col sm:flex-row justify-center items-center space-y-5 space-x-0 sm:space-y-0 sm:space-x-5">
      {routes.map((route) => (
        <Link
          key={route}
          href={`/dashboard/${route}`}
          className="btn btn-accent text-base text-center w-1/2 sm:text-xl sm:w-1/5"
          type="button"
        >
          {route}
        </Link>
      ))}
    </div>
  );
};

export default Dashboard;
