import React from "react";
import { Composition } from "remotion";
import { AutoMouseDemo } from "./Video";
import { AutoMouseDemo2, FPS2, TOTAL_FRAMES_2 } from "./Video2";
import { DURATION_FRAMES, FPS } from "./tokens";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="AutoMouseDemo"
        component={AutoMouseDemo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="AutoMouseDemo-2"
        component={AutoMouseDemo2}
        durationInFrames={TOTAL_FRAMES_2}
        fps={FPS2}
        width={1920}
        height={1080}
      />
    </>
  );
};
