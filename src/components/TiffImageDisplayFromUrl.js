import React, { useEffect, useRef } from "react";

const TiffImageDisplayFromURL = ({ imageUrl }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const fetchAndDisplayTiff = async () => {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        const reader = new FileReader();
        reader.onload = function (e) {
          const tiff = new Tiff({ buffer: e.target.result });
          const canvas = tiff.toCanvas();
          canvasRef.current.innerHTML = ""; // Clear previous canvas content
          canvasRef.current.appendChild(canvas); // Display the new canvas
        };
        reader.readAsArrayBuffer(blob);
      } catch (error) {
        console.error("Error fetching or processing TIFF image:", error);
      }
    };

    if (imageUrl) {
      fetchAndDisplayTiff();
    }
  }, [imageUrl]);

  return <div id="tifImg" ref={canvasRef}></div>;
};

export default TiffImageDisplayFromURL;
