// take the miliseconds to hours, minutes, seconds in a string format
export const formatTime = (milliseconds: number) => {
  // Handle negative values by returning 00:00:00
  if (milliseconds < 0) {
    return "00:00:00";
  }
  
  // Handle very large numbers that would cause overflow
  if (!isFinite(milliseconds) || milliseconds > Number.MAX_SAFE_INTEGER) {
    return "00:00:00";
  }

  // Convert milliseconds to seconds
  const totalSeconds = Math.floor(milliseconds / 1000);
  
  // Calculate hours, minutes, seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let timeString =
    hours.toString().padStart(2, "0") +
    ":" +
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0");
  return timeString;
};
