import React from "react";
import { useCurrentFrame } from "remotion";

interface Props {
  text: string;
  startFrame?: number;
  /** Frames between each character */
  speed?: number;
  style?: React.CSSProperties;
}

export const Typewriter: React.FC<Props> = ({
  text,
  startFrame = 0,
  speed = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);
  const chars = Math.min(text.length, Math.floor(localFrame / speed));
  const visible = text.slice(0, chars);
  const showCursor = chars < text.length;

  return (
    <span style={style}>
      {visible}
      {showCursor && (
        <span
          style={{
            opacity: Math.floor(localFrame / 15) % 2 === 0 ? 1 : 0,
            borderRight: "2px solid currentColor",
            marginLeft: 1,
          }}
        />
      )}
    </span>
  );
};
