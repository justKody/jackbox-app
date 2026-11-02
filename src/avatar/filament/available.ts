import { TurboModuleRegistry } from 'react-native';

/**
 * Filament and its worklet runtime are native modules, so they're missing from Expo Go and from
 * builds made before they were added. The canvases show the 2D portraits there instead.
 */
export const filamentAvailable = TurboModuleRegistry.get('FilamentModule') != null && TurboModuleRegistry.get('Worklets') != null;
