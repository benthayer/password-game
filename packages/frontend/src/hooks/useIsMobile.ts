/**
 * Tracks whether we're on a narrow (phone) viewport.
 *
 * Matches the 640px breakpoint used by mobile.css. Desktop always evaluates
 * to false, so any behaviour gated on this hook is mobile-only by construction.
 */

import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 640px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
