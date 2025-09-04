const TranscriptDisplay = ({ task, role }) => {
  let text = "";
  let taskId = task.id || "";

  // Get the appropriate context based on role
  if (role === "TRANSCRIBER") {
    // Show what the transcriber submitted
    text = task.corrected_context || task.diplomatic_context || "";
  } else if (role === "REVIEWER") {
    // Show what the reviewer corrected/approved
    text = task.reviewed_context || task.corrected_context || task.diplomatic_context || "";
  } else if (role === "FINAL_REVIEWER") {
    // Show what the final reviewer finalized
    text = task.final_reviewed_context || task.reviewed_context || task.diplomatic_context || "";
  }

  const cleanText = stripHtml(text); // Stripping HTML tags

  function stripHtml(html) {
    return html?.replace(/<[^>]*(>|$)|&nbsp;|\s{2,}/g, " ").trim();
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="text-xs text-gray-300 mb-1">
        ID: {taskId}
      </div>
      <p
        className="text-sm line-clamp-2 text-white"
        title={cleanText}
      >
        {cleanText || "No content available"}
      </p>
    </div>
  );
};

export default TranscriptDisplay;
