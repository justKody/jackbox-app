import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSettings } from '../../core/settings';
import { whenUnlocked } from '../../core/unlock';
import { playVoice } from './speaker';

const VISITED_KEY = 'trivia:visited';

/** The Hat welcomes players back on every launch after their first. */
export function greetReturningPlayer() {
  loadSettings()
    .then(() => AsyncStorage.getItem(VISITED_KEY))
    .then((visited) => {
      AsyncStorage.setItem(VISITED_KEY, '1').catch(() => {});
      if (!visited) return;
      // Browsers hold audio until the first tap, so the greeting waits for it there.
      whenUnlocked(() => playVoice('welcomeBack'));
    })
    .catch(() => {});
}
