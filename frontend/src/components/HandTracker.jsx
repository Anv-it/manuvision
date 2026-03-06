import React, { useEffect, useRef } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

export default function HandTracker({
  latestLandmarksRef,
  latestHandednessRef,
  onHandDetected,
  onStatus,
  onStream,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    let camera;

    async function init() {
      try {
        onStatus?.("Initializing...");

        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults((results) => {
          const lm = results?.multiHandLandmarks?.[0] ?? null;
          const rawHandedness = results?.multiHandedness?.[0]?.label ?? null;
          const handednessLabel =
            rawHandedness === "Left"
              ? "Right"
              : rawHandedness === "Right"
              ? "Left"
              : null;

          if (!lm) {
            latestLandmarksRef.current = null;
            if (latestHandednessRef) latestHandednessRef.current = null;
            onHandDetected?.(false);
            return;
          }

          latestLandmarksRef.current = lm.map((p) => [p.x, p.y, p.z]);
          if (latestHandednessRef) latestHandednessRef.current = handednessLabel;
          onHandDetected?.(true);
        });

        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            await hands.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });

        await camera.start();

        const stream = videoRef.current?.srcObject ?? null;
        if (stream) onStream?.(stream);

        onStatus?.("Running ✅ (show your hand)");
      } catch (e) {
        console.error(e);
        onStatus?.("Failed to init MediaPipe ❌");
      }
    }

    init();

    return () => {
      try {
        camera?.stop();
      } catch {}
    };
  }, []);

  // This video is hidden: MediaPipe reads frames from it.
  return <video ref={videoRef} className="hidden" autoPlay playsInline muted />;
}