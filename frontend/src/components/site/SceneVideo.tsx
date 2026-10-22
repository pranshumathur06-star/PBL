import { useEffect, useRef, useState } from "react";

// Muted stock clip that plays only while it is on screen and pauses when it scrolls away.
// Under prefers-reduced-motion it never autoplays and stays on its first frame.
export default function SceneVideo({ src, label, className = "", testId }: { src: string; label: string; className?: string; testId?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`relative overflow-hidden bg-ease-panel ${className}`}>
      {!failed && (
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={label}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          data-testid={testId}
        />
      )}
      {failed && (
        <div className="grid-bg h-full w-full bg-gradient-to-br from-[#0F2A52] to-ease-navy" role="img" aria-label={label} data-testid={testId ? `${testId}-fallback` : undefined} />
      )}
    </div>
  );
}
