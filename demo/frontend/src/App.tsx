import { useEffect, useState } from 'react';
import { LowFiWorkbench } from './pages/LowFiWorkbench';

const TEST_PATH = '/test';

function isTestRoute(pathname: string): boolean {
  return pathname === TEST_PATH || pathname === `${TEST_PATH}/`;
}

function RedirectToTest({ onRedirect }: { onRedirect: (path: string) => void }) {
  useEffect(() => {
    window.history.replaceState(null, '', TEST_PATH);
    onRedirect(TEST_PATH);
  }, [onRedirect]);

  return null;
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

  if (isTestRoute(pathname)) {
    return <LowFiWorkbench />;
  }

  // Swap this line to `<HiFiHome />` when the root UI is ready.
  return <RedirectToTest onRedirect={setPathname} />;
}

export default App;
