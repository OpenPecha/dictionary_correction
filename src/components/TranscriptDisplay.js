const TranscriptDisplay = ({ task, role }) => {
  let text = "";

  if (role === "TRANSCRIBER") {
    text =
      task.transcript !== null ? task.transcript : task.inference_transcript;
  } else if (role === "REVIEWER") {
    text =
      task.reviewed_transcript !== null
        ? task.reviewed_transcript
        : task.transcript;
  } else {
    text =
      task.final_reviewed_transcript !== null
        ? task.final_reviewed_transcript
        : task.reviewed_transcript;
  }

  const cleanText = stripHtml(text); // Stripping HTML tags

  function stripHtml(html) {
    return html?.replace(/<[^>]*(>|$)|&nbsp;|\s{2,}/g, " ").trim();
  }

  return (
    <p
      className="text-lg line-clamp-2"
      dangerouslySetInnerHTML={{
        __html: cleanText,
      }}
    />
  );
};

export default TranscriptDisplay;
