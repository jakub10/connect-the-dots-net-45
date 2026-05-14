import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  size: number;
  life: number;
  shape: 'rect' | 'circle';
}

const COLORS = ['#FDE047', '#F97316', '#EC4899', '#3B82F6', '#22C55E', '#A855F7', '#14B8A6'];

interface ConfettiProps {
  active: boolean;
  onDone?: () => void;
}

export function Confetti({ active, onDone }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array.from({ length: 120 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 12 + 6),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 8 + 5,
      life: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));

    let lastTime = performance.now();

    function loop(ts: number) {
      const dt = (ts - lastTime) / 16.67; // normalize to 60fps
      lastTime = ts;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;

        p.vy += 0.35 * dt;  // gravity
        p.vx *= Math.pow(0.99, dt); // air resistance
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotationSpeed * dt;
        p.life -= 0.012 * dt;

        ctx!.save();
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();
      }

      if (alive) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        onDone?.();
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[200] pointer-events-none"
    />
  );
}
