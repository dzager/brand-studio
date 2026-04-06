import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DARK, FONT_FAMILY, YELLOW } from "../tokens";

interface Props {
  text: string;
  appearFrame?: number;
  bottom?: number;
  right?: number;
}

export const FeatureBadge: React.FC<Props> = ({
  text,
  appearFrame = 20,
  bottom = 64,
  right = 80,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - appearFrame);

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.8 },
    from: 0.6,
    to: 1,
  });

  const opacity = interpolate(localFrame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom,
        right,
        background: YELLOW,
        color: DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        fontSize: 22,
        padding: "14px 28px",
        borderRadius: 10,
        letterSpacing: "-0.02em",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        transform: `scale(${scale})`,
        opacity,
        maxWidth: 560,
        textAlign: "center",
        lineHeight: 1.3,
      }}
    >
      {text}
    </div>
  );
};
