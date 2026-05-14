import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Star, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrawlGameProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Canvas size ─────────────────────────────────────────────
const W = 560;
const H = 560;

// ─── Player constants ────────────────────────────────────────
const PLAYER_R = 18;
const PLAYER_SPEED = 2.8;
const PLAYER_MAX_HP = 5;
const SHOOT_CD = 380; // ms between auto-shots

// ─── Bullet constants ────────────────────────────────────────
const BULLET_R = 6;
const BULLET_SPEED = 8;

// ─── Enemy definitions ───────────────────────────────────────
type EnemyType = 'grunt' | 'speeder' | 'tank';

const ENEMY_DEFS: Record<EnemyType, {
  color: string; outline: string; speed: number;
  hp: number; r: number; score: number; damage: number;
}> = {
  grunt:   { color: '#EF4444', outline: '#B91C1C', speed: 1.3,  hp: 2, r: 16, score: 10, damage: 1 },
  speeder: { color: '#F97316', outline: '#C2410C', speed: 2.6,  hp: 1, r: 12, score: 15, damage: 1 },
  tank:    { color: '#8B5CF6', outline: '#6D28D9', speed: 0.65, hp: 6, r: 22, score: 25, damage: 2 },
};

// ─── Wave definitions ─────────────────────────────────────────
const MAX_WAVES = 5;

function buildWave(wave: number): EnemyType[] {
  const types: EnemyType[] = [];
  const grunts   = Math.min(3 + wave * 2, 12);
  const speeders = wave >= 2 ? Math.min((wave - 1) * 2, 6) : 0;
  const tanks    = wave >= 3 ? Math.min(Math.floor((wave - 2) / 2), 3) : 0;
  for (let i = 0; i < grunts;   i++) types.push('grunt');
  for (let i = 0; i < speeders; i++) types.push('speeder');
  for (let i = 0; i < tanks;    i++) types.push('tank');
  return types;
}

// ─── Types ────────────────────────────────────────────────────
interface Vec { x: number; y: number; }

interface PlayerG {
  x: number; y: number;
  hp: number;
  lastShot: number;
  invincible: number; // ms remaining
  angle: number;
}

interface EnemyG {
  id: number; type: EnemyType;
  x: number; y: number;
  hp: number; maxHp: number;
}

interface BulletG {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
}

// Decorative bushes (no collision, just visual)
interface Bush { x: number; y: number; r: number; }

type Phase = 'idle' | 'playing' | 'between-waves' | 'game-over' | 'victory';

interface GameG {
  player: PlayerG;
  enemies: EnemyG[];
  bullets: BulletG[];
  bushes: Bush[];
  score: number;
  wave: number;
  phase: Phase;
  waveTimer: number; // countdown ms for between-waves
  nextId: number;
}

// ─── Helpers ──────────────────────────────────────────────────
function randBetween(a: number, b: number) { return a + Math.random() * (b - a); }

function spawnEdgePos(r: number): Vec {
  const edge = Math.floor(Math.random() * 4);
  const m = r + 15;
  if (edge === 0) return { x: randBetween(m, W - m), y: m };
  if (edge === 1) return { x: randBetween(m, W - m), y: H - m };
  if (edge === 2) return { x: m, y: randBetween(m, H - m) };
  return { x: W - m, y: randBetween(m, H - m) };
}

function makeBushes(): Bush[] {
  const positions = [
    { x: 120, y: 120, r: 22 }, { x: W - 120, y: 120, r: 18 },
    { x: 120, y: H - 120, r: 20 }, { x: W - 120, y: H - 120, r: 24 },
    { x: W / 2, y: 80, r: 16 }, { x: W / 2, y: H - 80, r: 16 },
    { x: 80, y: H / 2, r: 18 }, { x: W - 80, y: H / 2, r: 18 },
  ];
  return positions;
}

function makeGame(): GameG {
  return {
    player: { x: W / 2, y: H / 2, hp: PLAYER_MAX_HP, lastShot: 0, invincible: 0, angle: 0 },
    enemies: [], bullets: [],
    bushes: makeBushes(),
    score: 0, wave: 0, phase: 'idle', waveTimer: 0, nextId: 0,
  };
}

function startWave(g: GameG, wave: number) {
  g.wave = wave;
  g.phase = 'playing';
  g.bullets = [];
  const types = buildWave(wave);
  g.enemies = types.map(type => {
    const def = ENEMY_DEFS[type];
    const pos = spawnEdgePos(def.r);
    return { id: ++g.nextId, type, x: pos.x, y: pos.y, hp: def.hp, maxHp: def.hp };
  });
}

// ─── Drawing helpers ──────────────────────────────────────────
function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.75, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();
}

function drawEyes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const eo = r * 0.32;
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(x - eo * 0.65, y - eo * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + eo * 0.65, y - eo * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(x - eo * 0.6, y - eo * 0.2, r * 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + eo * 0.6, y - eo * 0.2, r * 0.11, 0, Math.PI * 2); ctx.fill();
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string, lw = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// ─── Component ────────────────────────────────────────────────
export function BrawlGame({ isOpen, onClose }: BrawlGameProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const gameRef    = useRef<GameG>(makeGame());
  const keysRef    = useRef(new Set<string>());
  const touchRef   = useRef<{ start: Vec; delta: Vec } | null>(null);

  const [ui, setUi] = useState<{ phase: Phase; score: number; wave: number; hp: number }>({
    phase: 'idle', score: 0, wave: 1, hp: PLAYER_MAX_HP,
  });

  const syncUi = useCallback((g: GameG) => {
    setUi({ phase: g.phase, score: g.score, wave: g.wave, hp: g.player.hp });
  }, []);

  const startGame = useCallback(() => {
    const g = makeGame();
    startWave(g, 1);
    gameRef.current = g;
    syncUi(g);
  }, [syncUi]);

  // ─── Game loop via useEffect ───────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    let rafId: number;
    let lastTime = performance.now();

    function update(dt: number, ts: number) {
      const g = gameRef.current;
      if (g.phase !== 'playing' && g.phase !== 'between-waves') return;

      if (g.phase === 'between-waves') {
        g.waveTimer -= dt;
        if (g.waveTimer <= 0) {
          startWave(g, g.wave + 1);
          syncUi(g);
        }
        return;
      }

      const { player } = g;

      // ── Player movement ──────────────────────────────────
      let dx = 0, dy = 0;
      const k = keysRef.current;
      if (k.has('ArrowLeft')  || k.has('a') || k.has('A')) dx -= 1;
      if (k.has('ArrowRight') || k.has('d') || k.has('D')) dx += 1;
      if (k.has('ArrowUp')    || k.has('w') || k.has('W')) dy -= 1;
      if (k.has('ArrowDown')  || k.has('s') || k.has('S')) dy += 1;

      if (touchRef.current) {
        const td = touchRef.current.delta;
        const len = Math.hypot(td.x, td.y);
        if (len > 8) { dx = td.x / len; dy = td.y / len; }
      }

      if (dx !== 0 && dy !== 0) { dx /= Math.SQRT2; dy /= Math.SQRT2; }
      player.x = Math.max(PLAYER_R, Math.min(W - PLAYER_R, player.x + dx * PLAYER_SPEED));
      player.y = Math.max(PLAYER_R, Math.min(H - PLAYER_R, player.y + dy * PLAYER_SPEED));

      // ── Auto-aim ──────────────────────────────────────────
      let nearest: EnemyG | null = null;
      let nearestDist = Infinity;
      for (const e of g.enemies) {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }

      if (nearest) {
        player.angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
        if (ts - player.lastShot >= SHOOT_CD) {
          player.lastShot = ts;
          const bx = player.x + Math.cos(player.angle) * (PLAYER_R + BULLET_R + 2);
          const by = player.y + Math.sin(player.angle) * (PLAYER_R + BULLET_R + 2);
          g.bullets.push({
            id: ++g.nextId,
            x: bx, y: by,
            vx: Math.cos(player.angle) * BULLET_SPEED,
            vy: Math.sin(player.angle) * BULLET_SPEED,
          });
        }
      }

      // ── Update bullets ────────────────────────────────────
      const deadBullets = new Set<number>();
      const deadEnemies = new Set<number>();

      for (const b of g.bullets) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
          deadBullets.add(b.id); continue;
        }
        for (const e of g.enemies) {
          if (deadEnemies.has(e.id) || deadBullets.has(b.id)) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < BULLET_R + ENEMY_DEFS[e.type].r) {
            e.hp--;
            deadBullets.add(b.id);
            if (e.hp <= 0) { deadEnemies.add(e.id); g.score += ENEMY_DEFS[e.type].score; }
          }
        }
      }

      g.bullets  = g.bullets.filter(b => !deadBullets.has(b.id));
      g.enemies  = g.enemies.filter(e => !deadEnemies.has(e.id));

      // ── Update enemies ────────────────────────────────────
      if (player.invincible > 0) player.invincible -= dt;

      for (const e of g.enemies) {
        const def = ENEMY_DEFS[e.type];
        const ang = Math.atan2(player.y - e.y, player.x - e.x);
        e.x = Math.max(def.r, Math.min(W - def.r, e.x + Math.cos(ang) * def.speed));
        e.y = Math.max(def.r, Math.min(H - def.r, e.y + Math.sin(ang) * def.speed));

        if (player.invincible <= 0 &&
            Math.hypot(e.x - player.x, e.y - player.y) < PLAYER_R + def.r) {
          player.hp -= def.damage;
          player.invincible = 1200;
          if (player.hp <= 0) {
            player.hp = 0;
            g.phase = 'game-over';
            syncUi(g); return;
          }
          syncUi(g);
        }
      }

      // ── Wave clear ────────────────────────────────────────
      if (g.enemies.length === 0) {
        if (g.wave >= MAX_WAVES) {
          g.phase = 'victory';
        } else {
          g.phase = 'between-waves';
          g.waveTimer = 2500;
        }
        syncUi(g);
      }
    }

    function draw(ts: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const g = gameRef.current;

      // ── Background ────────────────────────────────────────
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Border
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, W - 10, H - 10);

      // ── Bushes ────────────────────────────────────────────
      for (const b of g.bushes) {
        // Dark shadow bush
        ctx.beginPath();
        ctx.arc(b.x + 3, b.y + 3, b.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fill();
        // Main bush
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#16A34A';
        ctx.fill();
        // Highlight
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fill();
      }

      // ── Bullets ───────────────────────────────────────────
      for (const b of g.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
        ctx.fillStyle = '#FDE047';
        ctx.fill();
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Glow
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_R + 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253,224,71,0.25)';
        ctx.fill();
      }

      // ── Enemies ───────────────────────────────────────────
      for (const e of g.enemies) {
        const def = ENEMY_DEFS[e.type];
        drawShadow(ctx, e.x, e.y, def.r);
        drawCircle(ctx, e.x, e.y, def.r, def.color, def.outline);
        drawEyes(ctx, e.x, e.y, def.r);

        // Enemy type label (small letter)
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.round(def.r * 0.7)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = e.type === 'grunt' ? '👊' : e.type === 'speeder' ? '💨' : '🛡️';
        ctx.font = `${Math.round(def.r * 0.75)}px Arial`;
        ctx.fillText(label, e.x, e.y + 1);

        // HP bar
        if (e.hp < e.maxHp) {
          const bw = def.r * 2.2;
          const bh = 5;
          const bx = e.x - bw / 2;
          const by = e.y - def.r - 11;
          ctx.fillStyle = '#1F2937';
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, bw, bh);
        }
      }

      // ── Player ────────────────────────────────────────────
      const p = g.player;
      const blink = p.invincible > 0 && Math.floor(ts / 90) % 2 === 0;
      if (!blink) {
        drawShadow(ctx, p.x, p.y, PLAYER_R);

        // Gun barrel
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#1E40AF';
        ctx.beginPath();
        ctx.roundRect(PLAYER_R - 2, -5, 18, 10, 3);
        ctx.fill();
        ctx.restore();

        // Body
        drawCircle(ctx, p.x, p.y, PLAYER_R, '#3B82F6', '#1D4ED8');

        // Star icon
        ctx.font = `${PLAYER_R}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', p.x, p.y + 1);
      }
    }

    function loop(ts: number) {
      const dt = Math.min(ts - lastTime, 50);
      lastTime = ts;
      update(dt, ts);
      draw(ts);
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      // Prevent arrow keys from scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOpen, syncUi]);

  // ─── Touch controls ───────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    touchRef.current = { start: { x: t.clientX, y: t.clientY }, delta: { x: 0, y: 0 } };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchRef.current) return;
    const t = e.touches[0];
    touchRef.current.delta = {
      x: t.clientX - touchRef.current.start.x,
      y: t.clientY - touchRef.current.start.y,
    };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    touchRef.current = null;
  }, []);

  if (!isOpen) return null;

  const starsEarned = ui.phase === 'victory' ? 3 : ui.phase === 'game-over' && ui.score >= 100 ? 2 : ui.phase === 'game-over' && ui.score >= 50 ? 1 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2">
      <div className="flex flex-col items-center gap-2 w-full max-w-[580px]">

        {/* Header */}
        <div className="flex items-center justify-between w-full px-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <span className="text-white font-bold text-xl tracking-wide">Brawlosféra</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* HUD bar */}
        {ui.phase !== 'idle' && (
          <div className="flex items-center gap-3 w-full px-1 bg-black/40 rounded-xl py-1.5 px-3">
            <div className="flex gap-0.5">
              {Array.from({ length: PLAYER_MAX_HP }).map((_, i) => (
                <Heart
                  key={i}
                  className={cn('h-5 w-5 transition-colors', i < ui.hp ? 'text-red-500 fill-red-500' : 'text-gray-600 fill-gray-600')}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 text-yellow-400 font-bold ml-auto">
              <Star className="h-4 w-4 fill-yellow-400" />
              <span>{ui.score}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: MAX_WAVES }).map((_, i) => (
                <div
                  key={i}
                  className={cn('w-4 h-1.5 rounded-full transition-colors', i < ui.wave ? 'bg-yellow-400' : 'bg-gray-600')}
                />
              ))}
            </div>
            <span className="text-white/70 text-xs font-semibold">vlna {ui.wave}/{MAX_WAVES}</span>
          </div>
        )}

        {/* Canvas */}
        <div className="relative w-full">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="rounded-2xl border-4 border-green-800 w-full touch-none select-none block"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />

          {/* ── Overlay: idle ── */}
          {ui.phase === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 rounded-2xl">
              <div className="text-6xl mb-3 animate-bounce">⭐</div>
              <h2 className="text-white text-3xl font-extrabold mb-1 tracking-wide">Brawlosféra</h2>
              <p className="text-green-300 text-sm mb-1">Přeži {MAX_WAVES} vln nepřátel!</p>
              <div className="flex gap-4 my-3 text-xs text-white/70">
                <span>👊 Grunt  ·  2 HP</span>
                <span>💨 Speeder  ·  1 HP</span>
                <span>🛡️ Tank  ·  6 HP</span>
              </div>
              <p className="text-white/50 text-xs mb-5">WASD / šipky · na mobilu prstem</p>
              <Button onClick={startGame} size="lg"
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold px-10 rounded-full text-lg shadow-lg shadow-yellow-500/40">
                ⚡ Hrát!
              </Button>
            </div>
          )}

          {/* ── Overlay: between-waves ── */}
          {ui.phase === 'between-waves' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 rounded-2xl pointer-events-none">
              <div className="text-4xl mb-2">🎯</div>
              <h2 className="text-white text-2xl font-bold">Vlna {ui.wave} hotova!</h2>
              <p className="text-green-300 mt-1 text-sm">Za chvilku přijde vlna {ui.wave + 1}…</p>
            </div>
          )}

          {/* ── Overlay: game-over ── */}
          {ui.phase === 'game-over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-2xl">
              <div className="text-5xl mb-2">💀</div>
              <h2 className="text-white text-3xl font-extrabold mb-2">Konec hry</h2>
              <div className="flex gap-1 mb-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Star key={i} className={cn('h-8 w-8', i < starsEarned ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 fill-gray-600')} />
                ))}
              </div>
              <p className="text-yellow-400 text-2xl font-bold mb-5">⭐ {ui.score} bodů</p>
              <Button onClick={startGame} size="lg"
                className="bg-red-500 hover:bg-red-400 text-white font-bold px-8 rounded-full">
                🔄 Znovu
              </Button>
            </div>
          )}

          {/* ── Overlay: victory ── */}
          {ui.phase === 'victory' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 rounded-2xl">
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-yellow-400 text-3xl font-extrabold mb-1">Výhra!</h2>
              <p className="text-white mb-1">Přežil jsi všech {MAX_WAVES} vln!</p>
              <div className="flex gap-1 mb-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Star key={i} className="h-8 w-8 text-yellow-400 fill-yellow-400 animate-pulse" />
                ))}
              </div>
              <p className="text-yellow-400 text-2xl font-bold mb-5">⭐ {ui.score} bodů</p>
              <Button onClick={startGame} size="lg"
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold px-8 rounded-full shadow-lg shadow-yellow-500/40">
                ⚡ Hrát znovu
              </Button>
            </div>
          )}
        </div>

        <p className="text-white/40 text-xs">WASD / šipky pohyb · automatické míření</p>
      </div>
    </div>
  );
}
