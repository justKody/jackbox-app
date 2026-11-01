import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { Look } from './skins';

/** A still, flat portrait of an animal in a given look — for tiles, the menu and 2D fallbacks. */
export function AnimalSwatch({ look, size = 48 }: { look: Look; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = look.palette;
  const s = look.species;
  const frog = s === 'frog';
  const eyeY = frog ? 30 : 54;
  const eyeX = frog ? 14 : 10;
  const fur = `url(#f${id})`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`f${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={p.furLight} />
          <Stop offset="1" stopColor={p.fur} />
        </LinearGradient>
      </Defs>

      {/* Ears go behind the head */}
      {s === 'fox' && (
        <G>
          <Path d="M 24 44 L 27 6 L 50 30 Z" fill={fur} />
          <Path d="M 76 44 L 73 6 L 50 30 Z" fill={fur} />
          <Path d="M 30 36 L 30 16 L 42 30 Z" fill={p.blush} />
          <Path d="M 70 36 L 70 16 L 58 30 Z" fill={p.blush} />
          <Path d="M 26 14 L 27 6 L 33 12 Z" fill={p.furDeep} />
          <Path d="M 74 14 L 73 6 L 67 12 Z" fill={p.furDeep} />
        </G>
      )}
      {s === 'cat' && (
        <G>
          <Path d="M 24 42 L 26 12 L 48 30 Z" fill={fur} />
          <Path d="M 76 42 L 74 12 L 52 30 Z" fill={fur} />
          <Path d="M 30 36 L 30 20 L 41 30 Z" fill={p.blush} />
          <Path d="M 70 36 L 70 20 L 59 30 Z" fill={p.blush} />
        </G>
      )}
      {s === 'bunny' && (
        <G>
          <Ellipse cx={38} cy={20} rx={8} ry={22} fill={fur} />
          <Ellipse cx={62} cy={20} rx={8} ry={22} fill={fur} />
          <Ellipse cx={38} cy={21} rx={4} ry={16} fill={p.blush} />
          <Ellipse cx={62} cy={21} rx={4} ry={16} fill={p.blush} />
        </G>
      )}
      {s === 'bear' && (
        <G>
          <Circle cx={27} cy={32} r={11} fill={fur} />
          <Circle cx={73} cy={32} r={11} fill={fur} />
          <Circle cx={27} cy={32} r={6} fill={p.blush} />
          <Circle cx={73} cy={32} r={6} fill={p.blush} />
        </G>
      )}
      {s === 'owl' && (
        <G>
          <Path d="M 26 38 L 24 18 L 40 30 Z" fill={p.furDeep} />
          <Path d="M 74 38 L 76 18 L 60 30 Z" fill={p.furDeep} />
        </G>
      )}

      {/* Scarf and head */}
      <Ellipse cx={50} cy={88} rx={25} ry={7} fill={p.scarf} />
      {frog ? (
        <G>
          <Circle cx={36} cy={31} r={12} fill={fur} />
          <Circle cx={64} cy={31} r={12} fill={fur} />
          <Ellipse cx={50} cy={58} rx={36} ry={27} fill={fur} />
        </G>
      ) : (
        <Ellipse cx={50} cy={56} rx={32} ry={30} fill={fur} />
      )}

      {/* Faces */}
      {s === 'fox' && <Ellipse cx={50} cy={72} rx={22} ry={12} fill={p.belly} />}
      {s === 'owl' && (
        <G>
          <Circle cx={40} cy={eyeY} r={13} fill={p.belly} />
          <Circle cx={60} cy={eyeY} r={13} fill={p.belly} />
        </G>
      )}
      <Ellipse cx={30} cy={68} rx={6} ry={3.5} fill={p.blush} opacity={0.6} />
      <Ellipse cx={70} cy={68} rx={6} ry={3.5} fill={p.blush} opacity={0.6} />
      {[50 - eyeX, 50 + eyeX].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={eyeY} r={s === 'owl' ? 8 : 6.5} fill={p.eye} />
          <Circle cx={x} cy={eyeY + 0.5} r={s === 'owl' ? 4 : 3.2} fill="#140C18" />
          <Circle cx={x - 2} cy={eyeY - 2.4} r={1.9} fill="#FFFFFF" />
        </G>
      ))}
      {(s === 'cat' || s === 'bunny') && (
        <G>
          <Circle cx={46} cy={70} r={5} fill={p.belly} />
          <Circle cx={54} cy={70} r={5} fill={p.belly} />
          <Path d="M 47 65 L 53 65 L 50 68.5 Z" fill={p.nose} />
        </G>
      )}
      {s === 'bear' && (
        <G>
          <Ellipse cx={50} cy={70} rx={12} ry={9} fill={p.belly} />
          <Ellipse cx={50} cy={66} rx={5} ry={3.4} fill={p.nose} />
        </G>
      )}
      {s === 'fox' && <Ellipse cx={50} cy={66} rx={4.5} ry={3.2} fill={p.nose} />}
      {s === 'owl' && <Path d="M 46 62 L 54 62 L 50 71 Z" fill={p.nose} />}
      {frog && <Path d="M 34 66 Q 50 78 66 66" stroke="#140C18" strokeWidth={2.4} strokeLinecap="round" fill="none" />}
    </Svg>
  );
}
