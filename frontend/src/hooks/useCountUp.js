import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Animates a number counting up from 0 to `target` once the returned ref's
 * element scrolls into view. Skips straight to `target` with no animation
 * under prefers-reduced-motion.
 */
export function useCountUp(target, { duration = 1200 } = {}) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion || !ref.current) return;
    const node = ref.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - (1 - progress) ** 3; // ease-out cubic
          setValue(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [target, duration, reducedMotion]);

  return [ref, value];
}
