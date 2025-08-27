"use client";
import { useState } from "react";
import BurgerIcon from "./BurgerIcon";
export default function Sidebar({ children }) {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="relative">
      {!showSidebar && <BurgerIcon setShowSidebar={setShowSidebar} />}
      <div
        className={`right-0 w-full h-[50vh] bg-[#54606e] p-2 text-white fixed z-40  ease-in-out duration-300 ${
          showSidebar ? "translate-x-0 " : "-translate-x-full"
        }`}
      >
        <button
          className="absolute right-0 bg-black p-2 hover:bg-slate-700 z-50 flex items-center text-3xl text-white cursor-pointer"
          onClick={() => setShowSidebar((prev) => !prev)}
        >
          ❌
        </button>
        <div className="h-full flex flex-col space-y-2">{children}</div>
      </div>
    </div>
  );
}
