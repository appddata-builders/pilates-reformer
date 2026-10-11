"use client";

import Image from "next/image";
import { useTranslation } from "@/lib/text/text-provider";

const TEAM_IMAGE = `${process.env.NEXT_PUBLIC_S3}pilates_5.jpg`;

export default function AboutTeam() {
  const { t } = useTranslation();
  return (
    <section id="nosotros" className="scroll-mt-40">
      <div
        className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <div className="reveal flex flex-col gap-6">
          <p className="eyebrow eyebrow-on-light">{t("about.team.text001")}</p>
          <h2 className="text-3xl font-semibold leading-tight md:text-4xl font-display">
            {t("about.team.text002")}</h2>
          <p className="text-base text-black/70">
            {t("about.team.text003")}</p>
          <p className="text-base text-black/70">
            {t("about.team.text004")}</p>
          <div className="rounded py-4">
            <p className="text-3xl font-semibold leading-tight md:text-4xl font-display">
              {t("about.team.text005")}</p>
            <p className="mt-2 text-base text-black/70">
              {t("about.team.text006")}</p>
          </div>
        </div>

        <div
          className="reveal relative h-112 overflow-hidden rounded-card border border-black/10 bg-[#d8cfc2] shadow-[0_25px_50px_rgba(27,26,24,0.15)] md:h-136 lg:h-152 lg:order-last"
        >
          <Image
            src={TEAM_IMAGE}
            alt={t("about.team.text007")}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-linear-to-t from-green-base/40 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
}
