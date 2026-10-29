import { useEffect } from 'react';
import { ArenaPreviewScreen } from './screens/ArenaPreviewScreen';
import { PaintScreen } from './screens/PaintScreen';
import { WantedScreen } from './screens/WantedScreen';
import { useScreen } from './state/app';
import { SettingsPanel } from './ui/SettingsPanel';

export function App() {
  const screen = useScreen();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  return (
    <div className="app" data-screen={screen}>
      <SettingsPanel />
      {screen === 'input' && <WantedScreen />}
      {screen === 'paint' && <PaintScreen />}
      {/* 階段 1：開戰準備位置先放擂台預覽，階段 2 換成開戰準備與決鬥 */}
      {screen === 'prep' && <ArenaPreviewScreen />}
    </div>
  );
}
