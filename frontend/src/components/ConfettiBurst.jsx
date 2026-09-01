import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const COLORS = ["#4F63F5", "#8B4FF2", "#FF3E8E", "#17C9B4", "#FF9E4F"];
const PARTICLE_COUNT = 90;
const DURATION_MS = 2800;

/**
 * A one-time confetti burst that plays when the hero first mounts, then
 * stops and clears itself — not a looping background animation. Skipped
 * entirely under prefers-reduced-motion rather than shown static, since a
 * frozen mid-burst frame reads as more broken than absent.
 */
export default function ConfettiBurst() {
  const canvasRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;

    function resize() {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }
    resize();

    const width = parent.getBoundingClientRect().width;
    const originX = width / 2;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI - Math.PI * 1.5; // upward spread
      const speed = 4 + Math.random() * 7;
      return {
        x: originX + (Math.random() - 0.5) * 120,
        y: 40 + Math.random() * 20,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.5 ? "rect" : "circle",
      };
    });

    let start = null;
    let frameId;

    function frame(timestamp) {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const rect = parent.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const progress = elapsed / DURATION_MS;
      const fadeStart = 0.65;
      const opacity = progress < fadeStart ? 1 : Math.max(0, 1 - (progress - fadeStart) / (1 - fadeStart));

      for (const p of particles) {
        p.vy += 0.14; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < DURATION_MS) {
        frameId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    }

    frameId = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
