import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageTransition — wraps every page with enter animation
 * Also scrolls to top on route change
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const ref = useRef(null);

  useEffect(() => {
    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Re-trigger animation
    if (ref.current) {
      ref.current.style.animation = 'none';
      ref.current.offsetHeight; // reflow
      ref.current.style.animation = '';
    }
  }, [location.pathname]);

  return (
    <div ref={ref} className="page-wrap" key={location.pathname}>
      {children}
    </div>
  );
}
