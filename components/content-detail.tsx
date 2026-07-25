"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { FaClock, FaHeart, FaMoon, FaSun } from "react-icons/fa6";

const morningSlots = [
  "7:00 AM - 8:00 AM",
  "8:00 AM - 9:00 AM",
  "9:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
];

const eveningSlots = [
  "5:00 PM - 6:00 PM",
  "6:00 PM - 7:00 PM",
  "7:00 PM - 8:00 PM",
  "8:00 PM - 9:00 PM",
];

const HORARIOS_BG = `${process.env.NEXT_PUBLIC_S3}pilates_7.jpg`;

export default function ContentDetail() {
  return (
    <section
      id="nosotros"
      className="relative isolate scroll-mt-40 overflow-hidden rounded-card bg-white p-6 shadow-lg"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(47,107,95,0.12),transparent_55%)]" />
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-card h-90 md:h-120 border border-black/10 bg-[#d8cfc2] shadow-[0_25px_50px_rgba(27,26,24,0.15)]"
        >
          {/* next/image en vez de background-image: sirve AVIF/WebP al tamaño
              real del hueco y carga en diferido. El original pesa 5 MB. */}
          <Image
            src={HORARIOS_BG}
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
          <div className="relative flex h-full flex-col justify-between p-6 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FaHeart className="text-red-300" />
              Studio 57 · Pilates Reformer
            </div>
            <div>
              <p className="eyebrow eyebrow-on-dark">Tu bienestar</p>
              <p className="mt-2 text-2xl font-semibold font-display">
                Pilates Reformer para tí.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="flex flex-col gap-6"
        >
          <div>
            <p className="eyebrow eyebrow-on-light">Reformers</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight font-display">
              Reformers que se adaptan a ti, generando resultados reales.
            </h2>
            <p className="mt-2 text-sm text-black/60">
              El Reformer es un equipo especializado con resortes que proporcionan resistencia controlada, permitiendo realizar movimientos precisos y fluidos, el cual se adapta tanto a principiantes como a personas con experiencia.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-green-base/20 bg-green-base/10 px-4 py-3 text-sm text-green-base"> 
            Un espacio donde puedes conectar con tu cuerpo.
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="#planes"
              className="inline-flex items-center gap-2 rounded-full bg-green-base px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-hover"
            >
              Ver planes
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
