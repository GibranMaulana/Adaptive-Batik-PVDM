import { useCallback, useEffect, useState } from 'react';
import { HowItWorks } from './pages/HowItWorks';
import { HiFiConverter } from './pages/HiFiConverter';
import { LowFiWorkbench } from './pages/LowFiWorkbench';

const TEST_PATH = '/test';

function isTestRoute(pathname: string): boolean {
  return pathname === TEST_PATH || pathname === `${TEST_PATH}/`;
}

/**
 * Lightweight pathname router for the demo frontend.
 */
function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname === nextPath) return;
    window.history.pushState(null, '', nextPath);
    setPathname(nextPath);
  }, []);

  if (pathname === '/how-it-works' || pathname === '/how-it-works/') return <HowItWorks />;

  if (isTestRoute(pathname)) {
    return <LowFiWorkbench />;
  }

  return <HiFiConverter onNavigate={navigate} />;
}

export default App;
