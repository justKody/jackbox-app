import { useEffect, useRef, useState } from 'react';
import { type Entity, type FilamentAsset, useBuffer, useFilamentContext, useModel } from 'react-native-filament';
import type { Look } from '../skins';
import { ANIMAL_MODELS, SKIN_TEXTURES } from './rig.generated';
import { applySkin, paletteId, type SkinTextures, skinColors } from './skin';

export type LoadedAnimal = { asset: FilamentAsset; root: Entity; look: Look };

type Skin = { look: Look; tex: SkinTextures };

/**
 * Loads one animal: its species' model plus the look's textures. Once the skin is on it joins the
 * scene shrunk to nothing, and the scene's render loop decides where (and whether) it shows.
 * Reports null when it unloads.
 */
export function AnimalAsset({ look, onLoad }: { look: Look; onLoad: (animal: LoadedAnimal | null) => void }) {
  // A new species is a new model; a new skin on the same species just repaints this one.
  return <SpeciesAsset key={look.species} look={look} onLoad={onLoad} />;
}

function SpeciesAsset({ look, onLoad }: { look: Look; onLoad: (animal: LoadedAnimal | null) => void }) {
  const { workletContext, renderableManager, transformManager, scene } = useFilamentContext();
  const model = useModel(ANIMAL_MODELS[look.species], { addToScene: false });
  const asset = model.state === 'loaded' ? model.asset : undefined;
  const root = model.state === 'loaded' ? model.rootEntity : undefined;
  const [skin, setSkin] = useState<Skin | null>(null);

  const report = useRef(onLoad);
  useEffect(() => {
    report.current = onLoad;
  });
  const inScene = useRef(false);

  useEffect(() => {
    if (!asset || !root || !skin) return;
    let live = true;
    const { look: shown, tex } = skin;
    const colors = skinColors(shown);
    const first = !inScene.current;
    inScene.current = true;
    workletContext
      .runAsync(() => {
        'worklet';
        applySkin(renderableManager, asset, colors, tex);
        if (first) {
          transformManager.setEntityScale(root, [0, 0, 0], false);
          scene.addAssetEntities(asset);
        }
      })
      .then(() => {
        if (live) report.current({ asset, root, look: shown });
      })
      .catch((e) => console.warn('Could not put the skin on the 3D animal.', e))
      // The swap decodes the textures there and then, so the files can go.
      .finally(() => [tex.fur, tex.scarf, tex.iris].forEach((b) => b.release()));
    return () => {
      live = false;
    };
  }, [asset, root, skin, workletContext, renderableManager, transformManager, scene]);

  useEffect(() => () => report.current(null), []);

  return <SkinFiles key={paletteId(look)} look={look} onReady={setSkin} />;
}

/** Fetches a look's three textures and hands them over together, so a skin never goes on half-loaded. */
function SkinFiles({ look, onReady }: { look: Look; onReady: (skin: Skin) => void }) {
  const files = SKIN_TEXTURES[paletteId(look)];
  // Released by whoever applies them.
  const fur = useBuffer({ source: files.fur, releaseOnUnmount: false });
  const scarf = useBuffer({ source: files.scarf, releaseOnUnmount: false });
  const iris = useBuffer({ source: files.iris, releaseOnUnmount: false });
  const latest = useRef({ look, onReady });
  useEffect(() => {
    latest.current = { look, onReady };
  });
  useEffect(() => {
    if (fur && scarf && iris) latest.current.onReady({ look: latest.current.look, tex: { fur, scarf, iris } });
  }, [fur, scarf, iris]);
  return null;
}
