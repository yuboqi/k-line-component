import { useMemo, useState } from 'react';
import { KLineChart, darkTheme, lightTheme, generateMockKLineData } from 'kline-component';
import './App.css';

const INDICATOR_OPTIONS = ['MA', 'EMA', 'BOLL', 'MACD', 'RSI', 'KDJ', 'VOL'];
const PRICE_INDICATORS = ['MA', 'EMA', 'BOLL'];
const NORMAL_INDICATORS = ['MACD', 'RSI', 'KDJ'];

function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(
    new Set(['MA', 'VOL', 'MACD'])
  );

  const data = useMemo(() => generateMockKLineData(500), []);
  const theme = isDark ? darkTheme : lightTheme;

  const toggleIndicator = (name: string) => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const indicators = useMemo(() => {
    const result: string[] = [];
    for (const ind of PRICE_INDICATORS) {
      if (activeIndicators.has(ind)) result.push(ind);
    }
    if (activeIndicators.has('VOL')) result.push('VOL');
    for (const ind of NORMAL_INDICATORS) {
      if (activeIndicators.has(ind)) result.push(ind);
    }
    return result;
  }, [activeIndicators]);

  return (
    <div className={`app ${isDark ? 'dark' : 'light'}`}>
      <header className="header">
        <div className="header-left">
          <span className="symbol">BTC/USDT</span>
          <span className="period">15m</span>
          {data.length > 0 && (
            <span className="last-price">
              <span className={data[data.length - 1].close >= data[data.length - 1].open ? 'up' : 'down'}>
                {data[data.length - 1].close.toFixed(2)}
              </span>
            </span>
          )}
        </div>
        <div className="header-right">
          <button className="theme-btn" onClick={() => setIsDark(!isDark)}>
            {isDark ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </header>

      <nav className="toolbar">
        {INDICATOR_OPTIONS.map(name => (
          <button
            key={name}
            className={`indicator-btn ${activeIndicators.has(name) ? 'active' : ''}`}
            onClick={() => toggleIndicator(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <main className="chart-container">
        <KLineChart
          data={data}
          theme={theme}
          indicators={indicators}
        />
      </main>
    </div>
  );
}

export default App;
