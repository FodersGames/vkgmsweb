import React, { useEffect, useRef, useState } from 'react';

// Scroll-triggered fade+rise reveal for public marketing pages — the content
// stays static once revealed (fires once), respects prefers-reduced-motion
// via the CSS transition itself being cheap/instant when motion is reduced.
export const Reveal = ({ children, className = '', as: Tag = 'div', ...rest }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
};
