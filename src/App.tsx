import { useEffect } from 'react';
import { BattleScreen } from './screens/BattleScreen';
import { PaintScreen } from './screens/PaintScreen';
import { PrepScreen } from './screens/PrepScreen';
import { RoundSummaryScreen } from './screens/RoundSummaryScreen';
import { WantedScreen } from './screens/WantedScreen';
import { useScreen } from './state/app';
import { SettingsPanel } from './ui/SettingsPanel';

export function App() {
  const screen = useScreen();
  const inBattle = screen === 'battle' || screen === 'paused';
  useEffect(() => {
    if (screen !== 'paused') window.scrollTo(0, 0);
  }, [screen]);
  return (
    <div className="app" data-screen={screen}>
      {/* 戰鬥中設定鈕在 HUD 內，避免蓋住擂台 */}
      <SettingsPanel showGear={!inBattle} />
      {screen === 'input' && <WantedScreen />}
      {screen === 'paint' && <PaintScreen />}
      {screen === 'prep' && <PrepScreen />}
      {inBattle && <BattleScreen />}
      {/* 階段 2：道歉位置先放回合結束畫面，階段 3 換成道歉與結尾 */}
      {screen === 'apology' && <RoundSummaryScreen />}
    </div>
  );
}
