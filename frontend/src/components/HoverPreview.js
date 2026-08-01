import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const DELAY_MS = 500;

// Quick Look–style hover preview: wrap a thumbnail with this and, after a
// short hover delay, a larger version floats near the cursor. Cancels
// cleanly on mouse-leave/scroll so it never gets "stuck" open.
export const HoverPreview = ({ src, alt = '', children, className = '' }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const onEnter = (e) => {
    const { clientX, clientY } = e;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setPos({ x: clientX, y: clientY });
      setShow(true);
    }, DELAY_MS);
  };

  const onMove = (e) => {
    if (show) setPos({ x: e.clientX, y: e.clientY });
  };

  const onLeave = () => {
    clearTimer();
    setShow(false);
  };

  if (!src) return <div className={className}>{children}</div>;

  // Keep the floating preview on-screen near the cursor.
  const PREVIEW_SIZE = 280;
  const margin = 16;
  const left = Math.min(pos.x + 20, window.innerWidth - PREVIEW_SIZE - margin);
  const top = Math.min(pos.y + 20, window.innerHeight - PREVIEW_SIZE - margin);

  return (
    <div className={className} onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
      {show && createPortal(
        <div
          className="animate-appear fixed z-[200] pointer-events-none rounded-2xl overflow-hidden shadow-2xl border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520]"
          style={{ left, top, width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
        >
          <img src={src} alt={alt} className="w-full h-full object-contain" />
        </div>,
        document.body
      )}
    </div>
  );
};
