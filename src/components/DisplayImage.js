import Image from "next/image";
import React, { useRef, useCallback } from "react";
import { useZoomImageMove } from "@zoom-image/react";

function DisplayImage({ task }) {
  const containerRef = useRef(null);
  const { createZoomImage } = useZoomImageMove();

  const url = task?.url;
  const handleImageLoad = useCallback(() => {
    if (containerRef.current) {
      createZoomImage(containerRef.current, {
        zoomFactor: 2,
      });
    }
  }, [url]);

  return (
    <div
      className="relative w-[90%] h-auto cursor-crosshair overflow-hidden"
      ref={containerRef}
    >
      <Image
        src={url}
        alt="image"
        width={1100}
        height={400}
        className="max-h-[40vh]"
        onLoad={handleImageLoad}
        priority={true}
      />
    </div>
  );
}

export default DisplayImage;
