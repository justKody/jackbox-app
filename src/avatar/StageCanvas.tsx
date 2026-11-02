import { View } from 'react-native';
import type { StageCanvasProps } from './canvasTypes';
import { filamentAvailable } from './filament/available';

/** The wardrobe pedestal on iOS and Android, rendered natively by Filament. */
export function StageCanvas(props: StageCanvasProps) {
  if (!filamentAvailable) {
    const { look, still, onScene, fallback, ...viewProps } = props;
    return <View {...viewProps}>{fallback}</View>;
  }
  // Required lazily so a build without the native module never loads it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FilamentStage } = require('./filament/StageScene') as typeof import('./filament/StageScene');
  return <FilamentStage {...props} />;
}
