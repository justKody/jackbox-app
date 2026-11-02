import Svg, { Path } from 'react-native-svg';

/** Four-point twinkle star. */
export function SparkleShape({ size, color = '#FFFFFF' }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M 12 0 C 12.8 8 16 11.2 24 12 C 16 12.8 12.8 16 12 24 C 11.2 16 8 12.8 0 12 C 8 11.2 11.2 8 12 0 Z" fill={color} />
    </Svg>
  );
}
