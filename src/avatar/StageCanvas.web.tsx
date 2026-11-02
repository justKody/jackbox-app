import { useEffect, useRef } from 'react';
import type { StageCanvasProps } from './canvasTypes';
import { GLSurface } from './GLSurface';
import { createStage } from './stage';

/** The wardrobe pedestal on web: three.js in a WebGL 2 canvas. */
export function StageCanvas({ look, still, onScene, fallback, ...viewProps }: StageCanvasProps) {
  // Read when the GL context arrives, which happens after mount.
  const latest = useRef({ look, still });
  useEffect(() => {
    latest.current = { look, still };
  });
  return <GLSurface {...viewProps} create={(gl, ready) => createStage(gl, latest.current.look, latest.current.still, ready)} onScene={onScene} fallback={fallback} />;
}
