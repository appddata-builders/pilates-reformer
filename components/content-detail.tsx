"use client";

import Image from "next/image";
import { FaHeart } from "react-icons/fa6";
import { useTranslation } from "@/lib/text/text-provider";

const HORARIOS_BG = `${process.env.NEXT_PUBLIC_S3}pilates_7.jpg`;

export default function ContentDetail() {
  const { t } = useTranslation();
  return (
    <section
      id="nosotros"
      className="relative isolate scroll-mt-40 overflow-hidden rounded-card bg-white p-6 shadow-lg"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(47,107,95,0.12),transparent_55%)]" />
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className="reveal relative overflow-hidden rounded-card h-90 md:h-120 border border-black/10 bg-[#d8cfc2] shadow-[0_25px_50px_rgba(27,26,24,0.15)]"
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
              {t("content.detail.text001")}</div>
            <div>
              <p className="eyebrow eyebrow-on-dark">{t("content.detail.text002")}</p>
              <p className="mt-2 text-2xl font-semibold font-display">
                {t("content.detail.text003")}</p>
            </div>
          </div>
        </div>

        <div
          className="reveal flex flex-col gap-6"
        >
          <div>
            <p className="eyebrow eyebrow-on-light">{t("content.detail.text004")}</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight font-display">
              {t("content.detail.text005")}</h2>
            <p className="mt-2 text-sm text-black/60">
              {t("content.detail.text006")}</p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-green-base/20 bg-green-base/10 px-4 py-3 text-sm text-green-base"> 
            {t("content.detail.text007")}</div>

          <div className="flex flex-wrap gap-3">
            <a
              href="#planes"
              className="inline-flex items-center gap-2 rounded-full bg-green-base px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-hover"
            >
              {t("content.detail.text008")}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
