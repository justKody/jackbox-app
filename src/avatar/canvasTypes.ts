import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import type { Look } from './skins';
import type { Stage } from './stage';

/**
 * What the screens hand the 3D canvas. It has a three.js build for web (`*.web.tsx`) and a
 * Filament build for iOS and Android; both drive the same imperative API.
 */

export type StageCanvasProps = {
  /** Read when the scene starts; later changes go through `Stage.setLook`. */
  look: Look;
  still: boolean;
  onScene: (stage: Stage | null) => void;
  fallback: ReactNode;
} & ViewProps;
