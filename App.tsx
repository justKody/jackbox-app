import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { Fraunces_600SemiBold_Italic, Fraunces_700Bold, Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WizardPlaceholder } from './src/components/WizardPlaceholder';
import { MagicSky } from './src/components/MagicSky';
import { SoundSheet } from './src/components/SoundSheet';
import RootNavigator from './src/navigation/RootNavigator';
import { greetReturningPlayer, initSound } from './src/sound';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
    Fraunces_800ExtraBold,
  });

  useEffect(initSound, []);
  useEffect(greetReturningPlayer, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }}>
        <MagicSky />
        <SafeAreaView style={{ flex: 1 }}>
          {!fontsLoaded ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <WizardPlaceholder size={120} mood="think" />
            </View>
          ) : (
            <RootNavigator />
          )}
        </SafeAreaView>
      </View>
      {fontsLoaded && <SoundSheet />}
    </SafeAreaProvider>
  );
}
