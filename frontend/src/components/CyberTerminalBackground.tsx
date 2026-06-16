import React, { useEffect, useRef, useCallback } from 'react';

const CyberTerminalBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastNoiseTimeRef = useRef<number>(0);
  const dimensionsRef = useRef<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const NOISE_INTERVAL_MS = 140;

  // ----- Resize Handler -----
  const handleResize = useCallback(() => {
    dimensionsRef.current = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = dimensionsRef.current.width;
      canvas.height = dimensionsRef.current.height;
    }
  }, []);

  // ----- Terminal Noise / Micro-glitch Renderer -----
  const drawTerminalNoise = useCallback(
    (timestamp: number) => {
      animationFrameRef.current = requestAnimationFrame(drawTerminalNoise);

      if (timestamp - lastNoiseTimeRef.current < NOISE_INTERVAL_MS) {
        return;
      }
      lastNoiseTimeRef.current = timestamp;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensionsRef.current;

      ctx.clearRect(0, 0, width, height);

      // ---- Micro-glitch : barres horizontales aléatoires ----
      const barCount =
        Math.random() < 0.25 ? Math.floor(Math.random() * 2) + 1 : 0;

      for (let i = 0; i < barCount; i++) {
        const y = Math.random() * height;
        const barHeight = Math.random() * 2.2 + 0.8;
        const alpha = Math.random() * 0.06 + 0.02;
        const greenIntensity = Math.random() * 30 + 15;

        ctx.fillStyle = `rgba(${greenIntensity}, ${greenIntensity + 50}, ${
          greenIntensity + 30
        }, ${alpha})`;
        ctx.fillRect(0, y, width, barHeight);
      }

      // ---- Rares pixels scintillants (bruit de fond terminal) ----
      if (Math.random() < 0.18) {
        const pixelCount = Math.floor(Math.random() * 5) + 1;
        for (let j = 0; j < pixelCount; j++) {
          const px = Math.random() * width;
          const py = Math.random() * height;
          const pixelAlpha = Math.random() * 0.05 + 0.02;
          ctx.fillStyle = `rgba(5, 150, 105, ${pixelAlpha})`;
          ctx.fillRect(px, py, 1.5, 1.5);
        }
      }

      // ---- Ligne de balayage supplémentaire (très rare) ----
      if (Math.random() < 0.08) {
        const scanY = Math.random() * height;
        const gradient = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
        gradient.addColorStop(0, 'rgba(5, 150, 105, 0)');
        gradient.addColorStop(0.5, 'rgba(5, 150, 105, 0.04)');
        gradient.addColorStop(1, 'rgba(5, 150, 105, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, scanY - 3, width, 6);
      }
    },
    []
  );

  // ----- Setup & Cleanup -----
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    animationFrameRef.current = requestAnimationFrame(drawTerminalNoise);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleResize, drawTerminalNoise]);

  return (
    <div
      id="cyber-terminal-bg"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-[#09090b]"
      aria-hidden="true"
    >
      {/* ---------- DIGITAL GRID OVERLAY ---------- */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(24,24,27,0.5) 39px, rgba(24,24,27,0.5) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(24,24,27,0.5) 39px, rgba(24,24,27,0.5) 40px),
            repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(17,17,21,0.35) 7px, rgba(17,17,21,0.35) 8px),
            repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(17,17,21,0.35) 7px, rgba(17,17,21,0.35) 8px)
          `,
        }}
      />

      {/* ---------- GRID SCAN LINES ---------- */}
      <div className="absolute left-0 h-0.5 w-full animate-[scanDown_8s_linear_infinite] bg-linear-to-r from-transparent via-emerald-600/10 to-transparent shadow-[0_0_3px_rgba(5,150,105,0.08),0_0_8px_rgba(5,150,105,0.04)] blur-[1px]" />
      <div className="absolute left-0 h-0.5 w-full animate-[scanDown_8s_linear_infinite] bg-linear-to-r from-transparent via-emerald-600/10 to-transparent shadow-[0_0_3px_rgba(5,150,105,0.08),0_0_8px_rgba(5,150,105,0.04)] blur-[1px] opacity-60 [animation-delay:-4s]" />
      <div className="absolute left-0 h-px w-full animate-[scanDown_8s_linear_infinite] bg-linear-to-r from-transparent via-emerald-600/10 to-transparent shadow-[0_0_3px_rgba(5,150,105,0.08),0_0_8px_rgba(5,150,105,0.04)] blur-[1px] opacity-35 [animation-delay:-6.5s]" />

      {/* ---------- RANDOM STATIC BARS (CSS FLICKER) ---------- */}
      <div className="absolute left-0 top-[18%] h-px w-full animate-[staticFlicker_6s_ease-in-out_infinite] bg-emerald-60０/5 opacity-０" />
      <div className="absolute left-0 top-[42%] h-0.5 w-full animate-[staticFlicker_6s_ease-in-out_infinite] bg-emerald-600/5 opacity-0 [animation-delay:1.7s]" />
      <div className="absolute left-0 top-[73%] h-px w-full animate-[staticFlicker_6s_ease-in-out_infinite] bg-emerald-600/5 opacity-0 [animation-delay:3.4s]" />
      <div className="absolute left-0 top-[88%] h-0.5 w-full animate-[staticFlicker_6s_ease-in-out_infinite] bg-cyan-600/5 opacity-0 [animation-delay:5.1s]" />

      {/* ---------- AMBIENT CORNER GLOWS ---------- */}
      <div className="pointer-events-none absolute -left-30 -top-[120px] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,#059669_0%,transparent_70%)] opacity-[0.035] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-[120px] -right-[120px] h-[450px] w-[450px] rounded-full bg-[radial-gradient(circle,#0891b2_0%,transparent_70%)] opacity-[0.035] blur-[80px]" />
      <div className="pointer-events-none absolute -right-[80px] -top-[80px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(5,150,105,0.5)_0%,transparent_70%)] opacity-[0.025] blur-[80px]" />

      {/* ---------- DARK VIGNETTE ---------- */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />

      {/* ---------- TERMINAL NOISE CANVAS ---------- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-[0.22] mix-blend-screen"
      />

      {/* Inject keyframes into the document (scoped to this component) */}
      <style>{`
        @keyframes scanDown {
          0% { top: -10%; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }

        @keyframes staticFlicker {
          0%, 94%, 96%, 98%, 100% { opacity: 0; }
          95% { opacity: 0.5; }
          97% { opacity: 0.25; }
          99% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
};

export default CyberTerminalBackground;