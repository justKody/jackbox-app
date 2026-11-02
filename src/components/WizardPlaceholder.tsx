import { Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

/** The moods the Hat host can be in; each placeholder names the one its wizard should show. */
export type HatMood = 'idle' | 'wave' | 'cast' | 'think' | 'happy' | 'cheer' | 'sad' | 'shock';

/** Dashed stand-in for the Hat until a wizard drawing is added. */
export function WizardPlaceholder({ size = 120, mood = 'idle', style }: { size?: number; mood?: HatMood; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
        },
        style,
      ]}
    >
      <Text adjustsFontSizeToFit numberOfLines={3} style={{ fontFamily: fonts.medium, fontSize: Math.max(9, size / 9), color: colors.dim, textAlign: 'center' }}>
        Add {mood === 'idle' ? 'an' : 'a'} {mood} wizard
      </Text>
    </View>
  );
}
