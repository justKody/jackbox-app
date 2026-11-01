import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { Platform } from 'react-native';
import * as THREE from 'three';

/**
 * expo-gl's WebGL2 context also passes `instanceof WebGLRenderingContext` on native, which three
 * reads as WebGL 1 and refuses. Hide the WebGL 1 constructor just while the renderer is created.
 */
export function createRenderer(gl: ExpoWebGLRenderingContext) {
  const web = Platform.OS === 'web';
  if (!web) {
    // Only these two unpack flags exist on native; the rest just log a warning every upload.
    const pixelStorei = gl.pixelStorei.bind(gl);
    gl.pixelStorei = (pname: number, param: number | boolean) => {
      if (pname === gl.UNPACK_FLIP_Y_WEBGL || pname === gl.UNPACK_ALIGNMENT) pixelStorei(pname, param as number);
    };
  }
  const canvas = web
    ? (gl.canvas as HTMLCanvasElement)
    : ({
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        clientWidth: gl.drawingBufferWidth,
        clientHeight: gl.drawingBufferHeight,
        getContext: () => gl,
      } as unknown as HTMLCanvasElement);

  const g = globalThis as { WebGLRenderingContext?: unknown };
  const webgl1 = g.WebGLRenderingContext;
  if (!web) g.WebGLRenderingContext = undefined;
  try {
    return new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } finally {
    if (!web) g.WebGLRenderingContext = webgl1;
  }
}

/** Renderer tuned for the app: transparent over the sky, brand colours kept honest. */
export function setupRenderer(gl: ExpoWebGLRenderingContext) {
  const renderer = createRenderer(gl);
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  return renderer;
}

/**
 * Compile every shader before the first visible frame. Browsers can do this off the main thread
 * (no hitch while the screen animates in); elsewhere it just compiles up front.
 */
export async function warmUp(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    renderer.compile(scene, camera);
  }
}
