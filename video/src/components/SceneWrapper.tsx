import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY } from "../tokens";
import "@fontsource/geist";

interface Props {
  children: React.ReactNode;
  durationInFrames: number;
  background?: string;
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

export const SceneWrapper: React.FC<Props> = ({
  children,
  durationInFrames,
  background = "#FFFFFF",
  fadeInFrames = 8,
  fadeOutFrames = 8,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, fadeInFrames, durationInFrames - fadeOutFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background,
        fontFamily: FONT_FAMILY,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
