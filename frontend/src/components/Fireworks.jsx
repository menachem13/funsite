import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const COLORS = ["#4F63F5", "#8B4FF2", "#FF3E8E", "#17C9B4", "#FF9E4F"];
const MIN_LAUNCH_GAP_MS = 1400;
const MAX_LAUNCH_GAP_MS = 2600;

/**
 * A looping fireworks show in the hero background: shells launch from the
 * bottom at random intervals/positions, rise with a trail, and explode into
 * radial sparks. Runs only while the hero is actually on screen (paused via
 * IntersectionObserver when scrolled away) so it isn't burning CPU/battery
 * for a visitor who's read past the hero. Skipped entirely under
 * prefers-reduced-motion, same reasoning as ConfettiBurst.
 */
export default function Fireworks() {
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
    window.addEventListener("resize", resize);

    let shells = [];
    let particles = [];
    let nextLaunchAt = 0;
    let frameId = null;
    let paused = false;

    function scheduleNextLaunch(timestamp) {
      nextLaunchAt = timestamp + MIN_LAUNCH_GAP_MS + Math.random() * (MAX_LAUNCH_GAP_MS - MIN_LAUNCH_GAP_MS);
    }

    function spawnShell(width, height) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      shells.push({
        x: width * (0.12 + Math.random() * 0.76),
        y: height,
        targetY: height * (0.12 + Math.random() * 0.3),
        vy: -(7 + Math.random() * 2.5),
        color,
        trail: [],
      });
    }

    function explode(shell) {
      const count = 46 + Math.floor(Math.random() * 18);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15;
        const speed = 1.4 + Math.random() * 3.2;
        particles.push({
          x: shell.x,
          y: shell.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: shell.color,
          life: 1,
          size: 1.5 + Math.random() * 2,
        });
      }
    }

    function frame(timestamp) {
      if (paused) return;
      const rect = parent.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (timestamp >= nextLaunchAt) {
        spawnShell(rect.width, rect.height);
        scheduleNextLaunch(timestamp);
      }

      shells = shells.filter((s) => {
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 6) s.trail.shift();
        s.y += s.vy;

        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        s.trail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();

        if (s.y <= s.targetY) {
          explode(s);
          return false;
        }
        return true;
      });

      particles = particles.filter((p) => {
        p.vy += 0.045;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.014;
        if (p.life <= 0) return false;
        ctx.save();
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      });

      frameId = requestAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (paused || frameId === null) {
            paused = false;
            nextLaunchAt = performance.now() + 400;
            frameId = requestAnimationFrame(frame);
          }
        } else {
          paused = true;
          if (frameId) cancelAnimationFrame(frameId);
          frameId = null;
        }
      },
      { threshold: 0 }
    );
    observer.observe(parent);

    return () => {
      paused = true;
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return <canvas ref={canvasRef} className="fireworks-canvas" aria-hidden="true" />;
}
