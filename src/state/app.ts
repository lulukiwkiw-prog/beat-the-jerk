import { createStore, useStore } from './store';
import { transition, type GameEvent, type Screen } from './machine';

export const screenStore = createStore<Screen>('input');
export const useScreen = () => useStore(screenStore);

export function dispatch(event: GameEvent) {
  screenStore.set((s) => transition(s, event));
}
