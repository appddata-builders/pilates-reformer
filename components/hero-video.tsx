"use client";

import { RefObject, useEffect, useState } from "react";
import Image from "next/image";

const S3 = process.env.NEXT_PUBLIC_S3;

// La versión ligera (3.5 MB, sin audio, faststart) va primero; mientras no esté
// en el bucket, el navegador pasa sola a la original de 20 MB.
const VIDEO_SOURCES = [`${S3}studio57-hero.mp4`, `${S3}studio57.mp4`];

// Primer cuadro del video: se pinta al instante y se desvanece cuando el video
// ya está corriendo, así el cambio no se nota.
const POSTER_SRC = "/assets/hero/studio57-hero-poster.jpg";

type HeroVideoProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  onPlayingChange: (playing: boolean) => void;
};

export default function HeroVideo({ videoRef, onPlayingChange }: HeroVideoProps) {
  const [videoVisible, setVideoVisible] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Quien pidió menos movimiento o ahorra datos se queda con la imagen; el
    // botón de reproducir sigue funcionando.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduceMotion || connection?.saveData === true) return;

    // El video ya no compite con la carga de la página: se pide hasta que la
    // página terminó de cargar y el navegador quedó libre. Antes `autoPlay`
    // arrancaba la descarga desde el primer momento y trababa todo lo demás.
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const start = () => {
      video.play().catch(() => onPlayingChange(false));
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(start, { timeout: 2000 });
      } else {
        timeoutId = window.setTimeout(start, 300);
      }
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      window.removeEventListener("load", schedule);
      if (idleId != null) window.cancelIdleCallback(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [videoRef, onPlayingChange]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#1b1a18]">
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        preload="none"
        className="h-full w-full object-cover"
        onPlaying={() => {
          setVideoVisible(true);
          onPlayingChange(true);
        }}
        onPause={() => onPlayingChange(false)}
      >
        {VIDEO_SOURCES.map((src) => (
          <source key={src} src={src} type="video/mp4" />
        ))}
      </video>
      <Image
        src={POSTER_SRC}
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className={`pointer-events-none object-cover transition-opacity duration-1000 ease-out ${
          videoVisible ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}
