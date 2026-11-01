import { createStore, useStore } from '../createStore';

// The sound panel is mounted once at the app root; any screen's speaker button opens it.
const panelOpen = createStore(false);

export const setSoundPanelOpen = panelOpen.set;
export const useSoundPanelOpen = () => useStore(panelOpen);
