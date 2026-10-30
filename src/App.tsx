import { useEffect } from 'react';
import { BattleScreen } from './screens/BattleScreen';
import { PaintScreen } from './screens/PaintScreen';
import { PrepScreen } from './screens/PrepScreen';
import { WantedScreen } from './screens/WantedScreen';
import { useScreen } from './state/app';
import { SettingsPanel } from './ui/SettingsPanel';

export function App() {
  const screen = useScreen();
  const inBattle = screen === 'battle' || screen === 'paused';
  // 決鬥、道歉、結尾共用同一個擂台場景，切換時不重建
  const inArena = inBattle || screen === 'apology' || screen === 'ending';
  useEffect(() => {
    if (screen !== 'paused' && screen !== 'battle') window.scrollTo(0, 0);
  }, [screen]);
  return (
    <div className="app" data-screen={screen}>
      {/* 戰鬥中設定鈕在 HUD 內，避免蓋住擂台 */}
      <SettingsPanel showGear={!inArena} />
      {screen === 'input' && <WantedScreen />}
      {screen === 'paint' && <PaintScreen />}
      {screen === 'prep' && <PrepScreen />}
      {inArena && <BattleScreen />}
    </div>
  );
}
