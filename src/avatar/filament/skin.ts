import type { FilamentAsset, Float3, Float4, RenderableManager, useBuffer } from 'react-native-filament';
import type { Look } from '../skins';
import { linear, withAlpha } from './transforms';

/**
 * Skins on the baked models. Each species ships one .glb in its natural colours; a skin swaps
 * the fur, scarf and iris textures and recolours the flat-coloured parts.
 */

/** Which texture set a look uses: an animal's own colours, or a themed skin's (shared by every animal). */
export const paletteId = (look: Look) => {
  const skin = look.key.split(':')[1];
  return skin === 'natural' ? `natural-${look.species}` : skin;
};

/** The library doesn't export its buffer type, so take it from the hook that makes one. */
export type Buffer = NonNullable<ReturnType<typeof useBuffer>>;

export type SkinTextures = { fur: Buffer; scarf: Buffer; iris: Buffer };

export type SkinColors = { colors: Record<string, Float4>; glow: Float3 };

/**
 * Filament can't swap the emissive map at runtime, so a glowing skin gets a gentle glow over the
 * whole coat instead of only along its pattern. The pattern itself is still in the fur texture.
 */
const COAT_GLOW = 0.15;

export function skinColors(look: Look): SkinColors {
  const p = look.palette;
  const glow = look.glow > 0 && look.pattern !== 'none' ? linear(look.patternColor).map((c) => c * look.glow * COAT_GLOW) : [0, 0, 0];
  return {
    colors: { deep: withAlpha(linear(p.furDeep), 1), belly: withAlpha(linear(p.belly), 1), blush: withAlpha(linear(p.blush), 0.55), nose: withAlpha(linear(p.nose), 1) },
    glow: glow as Float3,
  };
}

/** Puts a look on every part of an animal asset. Runs on Filament's thread. */
export function applySkin(rm: RenderableManager, asset: FilamentAsset, skin: SkinColors, tex: SkinTextures) {
  'worklet';
  for (const e of asset.getRenderableEntities()) {
    const count = rm.getPrimitiveCount(e);
    for (let i = 0; i < count; i++) {
      const name = rm.getMaterialInstanceAt(e, i).name;
      if (name === 'fur') {
        rm.changeMaterialTextureMap(e, 'fur', tex.fur, 'sRGB');
        // The swap replaces the material instance, so set the glow on the new one.
        rm.getMaterialInstanceAt(e, i).setFloat3Parameter('emissiveFactor', skin.glow);
      } else if (name === 'scarf') rm.changeMaterialTextureMap(e, 'scarf', tex.scarf, 'sRGB');
      else if (name === 'iris') rm.changeMaterialTextureMap(e, 'iris', tex.iris, 'sRGB');
      else {
        const c = skin.colors[name];
        if (c) rm.getMaterialInstanceAt(e, i).setFloat4Parameter('baseColorFactor', c);
      }
    }
  }
}
