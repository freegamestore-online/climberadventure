import type { CSSProperties } from "react";
import { drawPixelChar, type Hat } from "../lib/drawChar";
import type { Gender } from "../types";

/** Standing character sprite on a 66x90 canvas, for menus. */
export function CharPreview({ gender, hat, style }: { gender: Gender; hat: Hat; style?: CSSProperties }) {
  return (
    <canvas width={66} height={90}
      style={{ imageRendering: "pixelated", ...style }}
      ref={el => {
        const c = el?.getContext("2d");
        if (!c) return;
        c.clearRect(0, 0, 66, 90);
        drawPixelChar(c, 22, 30, true, gender, hat, 0, false, false);
      }} />
  );
}
