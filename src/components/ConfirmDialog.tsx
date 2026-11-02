import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { native, useAnimatedValue } from '../motion';
import { alpha, colors, fonts } from '../theme';
import { HatMood, WizardPlaceholder } from './WizardPlaceholder';
import { FlagIcon, PrimaryButton } from './ui';

/** Centred card that pops over a dimmed sky to double-check a drastic choice. Tap outside or Android back to cancel. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep playing',
  mood = 'shock',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  mood?: HatMood;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useAnimatedValue(0);
  // Keeps the modal up while the close animation plays out.
  const [closing, setClosing] = useState(false);
  const cancel = () => {
    setClosing(true);
    onCancel();
  };

  useEffect(() => {
    Animated.timing(t, {
      toValue: visible ? 1 : 0,
      duration: visible ? 320 : 180,
      easing: visible ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.quad),
      useNativeDriver: native,
    }).start(({ finished }) => {
      if (finished && !visible) setClosing(false);
    });
  }, [visible, t]);

  return (
    <Modal transparent visible={visible || closing} onRequestClose={cancel} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: alpha('#05040C', 0.75), opacity: t }}>
        <Pressable accessibilityLabel={cancelLabel} style={{ flex: 1 }} onPress={cancel} />
      </Animated.View>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View
          accessibilityRole="alert"
          style={{
            width: '100%',
            maxWidth: 360,
            alignItems: 'center',
            gap: 10,
            paddingTop: 18,
            paddingBottom: 20,
            paddingHorizontal: 20,
            borderRadius: 28,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            opacity: t,
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          }}
        >
          <WizardPlaceholder size={84} mood={mood} />
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center', marginBottom: 6 }}>{message}</Text>
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <PrimaryButton label={cancelLabel} onPress={cancel} height={54} shine={false} />
            <PrimaryButton label={confirmLabel} onPress={onConfirm} height={54} color={colors.red} textColor="#FFFFFF" icon={<FlagIcon />} shine={false} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
