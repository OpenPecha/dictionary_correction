"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import languagesObject from "../../../data/language";

export default function DownloadPage() {
  const [languageSelected, setLanguageSelected] = useState("bo");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  
  const lang = languagesObject[languageSelected];

  useEffect(() => {
    // Fetch available groups
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups');
      const data = await response.json();
      setGroups(data);
      if (data.length > 0) {
        setSelectedGroup(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleDownload = async () => {
    if (!selectedGroup || !fromDate || !toDate) {
      alert('Please select all required fields');
      return;
    }

    setIsDownloading(true);
    
    try {
      const response = await fetch('/api/download-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: selectedGroup,
          fromDate,
          toDate,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `tasks-${selectedGroup}-${fromDate}-${toDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Error downloading file');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading file');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gray-100 py-8 ${
      languageSelected === "bo" && "font-OuChan text-lg"
    }`}>
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {languageSelected === "en" ? "Download Data" : "གྲངས་ཐོ་ཕབ་ལེན།"}
          </h1>
          <Link
            href="/"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
          >
            {languageSelected === "en" ? "← Back" : "← རྒྱབ་ལོག"}
          </Link>
        </div>

        <div className="space-y-6">
          {/* Language Toggle */}
          <div className="flex items-center justify-between">
            <label className="font-medium text-gray-700">
              {languageSelected === "en" ? "Language" : "སྐད་ཡིག"}
            </label>
            <div className="flex items-center gap-2">
              <span className={languageSelected === "en" ? "font-bold" : ""}>English</span>
              <input
                type="checkbox"
                checked={languageSelected === "bo"}
                onChange={(e) => setLanguageSelected(e.target.checked ? "bo" : "en")}
                className="toggle"
              />
              <span className={languageSelected === "bo" ? "font-bold" : ""}>བོད་ཡིག</span>
            </div>
          </div>

          {/* Group Selection */}
          <div>
            <label className="block font-medium text-gray-700 mb-2">
              {languageSelected === "en" ? "Select Group" : "སྡེ་ཚན་འདེམས།"}
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                {languageSelected === "en" ? "Choose a group..." : "སྡེ་ཚན་འདེམས་རོགས..."}
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                {languageSelected === "en" ? "From Date" : "ཚེས་འགོ"}
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                {languageSelected === "en" ? "To Date" : "ཚེས་མཇུག"}
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-center">
            <button
              onClick={handleDownload}
              disabled={isDownloading || !selectedGroup || !fromDate || !toDate}
              className={`px-8 py-3 rounded-md font-medium text-white ${
                isDownloading || !selectedGroup || !fromDate || !toDate
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              } flex items-center gap-2`}
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {languageSelected === "en" ? "Downloading..." : "ཕབ་ལེན་བྱེད་བཞིན..."}
                </>
              ) : (
                <>
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {languageSelected === "en" ? "Download CSV" : "CSV ཕབ་ལེན།"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
