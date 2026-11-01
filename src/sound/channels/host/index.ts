// The Hat's voice: one line at a time, plus gap-fillers for quiet stretches. Its lines follow the effects volume.
// Entry point for the host channel: the rest of src/sound imports from here, never from the files beside it.
import { startFillers } from './fillers';
import { startSpeaker } from './speaker';

export { setFillers } from './fillers';
export { greetReturningPlayer } from './greeting';
export { playQuestion, playVoice } from './speaker';

export function startHost() {
  const stops = [startSpeaker(), startFillers()];
  return () => stops.forEach((stop) => stop());
}
