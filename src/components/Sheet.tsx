import { ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { native, useAnimatedValue } from '../motion';
import { alpha, colors, fonts } from '../theme';
import { CloseIcon, RoundButton, styles } from './ui';

/** Bottom sheet that springs up over a dimmed sky; tap outside, the close button or Android back to dismiss. */
export function Sheet({ visible, onClose, title, icon, children }: { visible: boolean; onClose: () => void; title: string; icon?: ReactNode; children: ReactNode }) {
  const t = useAnimatedValue(0);
  const { height } = useWindowDimensions();
  // Keeps the modal up while the close animation plays out.
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    onClose();
  };

  useEffect(() => {
    Animated.timing(t, {
      toValue: visible ? 1 : 0,
      duration: visible ? 380 : 220,
      easing: visible ? Easing.out(Easing.back(1.1)) : Easing.in(Easing.quad),
      useNativeDriver: native,
    }).start(({ finished }) => {
      if (finished && !visible) setClosing(false);
    });
  }, [visible, t]);

  return (
    <Modal transparent visible={visible || closing} onRequestClose={close} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: alpha('#05040C', 0.7), opacity: t }}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={close} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: height * 0.88,
          paddingTop: 14,
          paddingHorizontal: 20,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: 10 }} />
        <View style={[styles.topBar, { marginBottom: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {icon}
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>{title}</Text>
          </View>
          <RoundButton label="Close" onPress={close}>
            <CloseIcon />
          </RoundButton>
        </View>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
