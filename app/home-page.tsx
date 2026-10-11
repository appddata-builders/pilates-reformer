"use client";

import { useEffect, useRef, useState } from "react";
import { FaPlayCircle, FaRegStopCircle } from "react-icons/fa";
import { FaInstagram, FaWhatsapp } from "react-icons/fa6";
import {
  siteInstagramHandle,
  siteInstagramUrl,
  sitePhoneDisplay,
  siteWhatsAppUrl,
} from "@/lib/site/routes";
import ContentDetail from "@/components/content-detail";
import SetupWeeklySchedule from "@/components/setup-weekly-schedule";
import HeroVideo from "@/components/hero-video";
import AboutTeam from "@/components/about-team";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { AccountNavLink } from "@/components/features/site/account-nav-link";
import { SubscribePlanButton } from "@/components/features/site/subscribe-plan-button";
import type { LandingScheduleBoard } from "@/lib/site/schedule-board.server";
import { planCardImage, type PublicPlan } from "@/lib/site/plans";
import { useTranslation } from "@/lib/text/text-provider";

const LOGO_SRC = `${process.env.NEXT_PUBLIC_S3}Studio57.jpeg`;



export function HomePage(props: {
  plans: PublicPlan[];
  initialBoard: LandingScheduleBoard;
  loggedIn?: boolean;
  /** La cuenta ya redimió su clase muestra: no se le vuelve a ofrecer. */
  trialUsed?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  // Arranca en pausa: el video se pide hasta que la página terminó de cargar.
  const [heroVideoPlaying, setHeroVideoPlaying] = useState(false);

  const planCards = props.plans.filter((plan) => plan.layout === "card");
  const planBars = props.plans.filter((plan) => plan.layout === "bar");
  const [selectedCadence, setSelectedCadence] = useState<Record<string, string>>({});

  const toggleHeroVideo = () => {
    const video = heroVideoRef.current;
    if (!video) return;
    if (video.paused) {
      video
        .play()
        .then(() => setHeroVideoPlaying(true))
        .catch(() => setHeroVideoPlaying(false));
    } else {
      video.pause();
      setHeroVideoPlaying(false);
    }
  };

  const navLinks = [
    { href: "#planes", label: t("home.nav.plans") },
    { href: "#nosotros", label: t("home.nav.about") },
    { href: routes.agendar, label: t("home.nav.schedule") },
    { href: "#cobros", label: t("home.nav.payments") },
  ];

  function goToAgendar() {
    router.push(routes.agendar);
  }

  const scrollToWeekly = () => {
    document
      .getElementById("weekly")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (window.location.hash !== "#weekly") {
      return;
    }
    const timer = window.setTimeout(() => {
      scrollToWeekly();
    }, 100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      id="top"
      className="relative min-h-screen overflow-clip bg-[#f9f0e3] text-[#1b1a18]"
    >
      <div className="pointer-events-none absolute -left-20 top-40 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(47,107,95,0.25),transparent_70%)] blur-3xl" />
      {/* Sin animación: queda detrás del video y animarla con blur costaba un repintado por cuadro. */}
      <div className="pointer-events-none absolute right-[-120px] top-[-60px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(47,79,79,0.35),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(255,215,186,0.5),transparent_70%)] blur-3xl" />

      {/* Sin backdrop-blur: con bg-white/95 casi no se notaba y sobre el video
          obligaba a desenfocar de nuevo en cada cuadro. */}
      <nav
        className="animate-fade-down fixed inset-x-0 top-0 z-50 w-full border pl-3 pr-4 py-2 transition border-black/10 bg-white/95 text-[#1b1a18] shadow-[0_12px_30px_rgba(27,26,24,0.12)]"
      >
        <div className="flex items-center justify-between gap-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <a
              href="#top"
              className="relative h-14 w-14 overflow-hidden"
            >
              <Image
                src={LOGO_SRC}
                alt={t("home.page.text001")}
                fill
                sizes="63px"
                className="object-cover shadow-lg shadow-white/20"
              />
            </a>
            <div>
              <p className="text-sm font-semibold tracking-wide">
                {t("home.page.text002")}</p>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm font-medium lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition hover:text-green-mid"
              >
                {link.label}
              </a>
            ))}
            <AccountNavLink
              initialLoggedIn={props.loggedIn}
              className="rounded-full bg-green-base px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-hover"
            />
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={t("home.page.text004")}
            aria-expanded={menuOpen}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition lg:hidden border-black/20 bg-white/90 text-[#1b1a18]`}
          >
            <span className="relative block h-4 w-4">
              <span
                className={`absolute left-0 top-0 h-0.5 w-full rounded-full transition bg-[#1b1a18] ${menuOpen ? "translate-y-1.5 rotate-45" : ""
                  }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-full rounded-full transition bg-[#1b1a18] ${menuOpen ? "opacity-0" : ""
                  }`}
              />
              <span
                className={`absolute left-0 top-3 h-0.5 w-full rounded-full transition bg-[#1b1a18] ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""
                  }`}
              />
            </span>
          </button>
        </div>
      </nav>

      {menuOpen && (
          <div
            className="animate-fade-in fixed inset-0 z-60 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <div
              className="animate-slide-in-right absolute right-4 top-24 max-h-[calc(100vh-7rem)] w-[min(85vw,320px)] overflow-y-auto rounded-card border border-black/10 bg-white/95 p-6 shadow-[0_25px_60px_rgba(27,26,24,0.2)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="eyebrow eyebrow-muted">{t("home.page.text005")}</p>
                  <p className="text-lg font-semibold">{t("home.page.text006")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/60"
                >
                  {t("home.page.text007")}</button>
              </div>
              <div className="flex flex-col gap-3 text-sm font-semibold text-[#1b1a18]">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-inner border border-black/5 bg-[#f6f1ea] px-4 py-3 transition hover:bg-[#eae1d6]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <AccountNavLink
                initialLoggedIn={props.loggedIn}
                onNavigate={() => setMenuOpen(false)}
                className="mt-5 block w-full rounded-full bg-green-base px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-green-hover"
              />
            </div>
          </div>
        )}

      <header className="relative isolate min-h-[70vh] overflow-hidden lg:min-h-[82vh]">
        <HeroVideo videoRef={heroVideoRef} onPlayingChange={setHeroVideoPlaying} />
        <div
          className="pointer-events-none absolute inset-0 z-1"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.28) 22%, rgba(249,240,227,0.2) 48%, rgba(249,240,227,0.6) 70%, rgba(249,240,227,0.9) 85%, #f9f0e3 100%)",
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-6xl flex-col gap-10 px-6 pb-20 pt-32 text-white sm:pt-36 lg:min-h-[82vh] lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch lg:pb-28 lg:pt-32">
          <div className="flex flex-col justify-center gap-8">
            <h1
              className="animate-fade-up text-center text-4xl text-[#f9ecda] font-semibold leading-tight font-display"
            >
              {t("home.page.text009")}<br />
              {t("home.page.text010")}</h1>
            <div
              className="animate-fade-up m-auto h-24 w-24 object-cover flex justify-center items-center p-2 rounded-full overflow-hidden bg-white"
              style={{ animationDelay: "60ms" }}
            >
              <Image
                src={LOGO_SRC}
                alt={t("home.page.text011")}
                width={80}
                height={80}
                className="h-20 w-20 object-cover mx-auto m-1"
                priority
              />
            </div>
            <h1
              className="animate-fade-up text-center text-4xl font-semibold leading-tight font-display"
              style={{ animationDelay: "120ms" }}
            >
              {t("home.page.text012")}</h1>
            <h2
              className="animate-fade-up text-center text-xl font-semibold text-white/80"
              style={{ animationDelay: "180ms" }}
            >
              {t("home.page.text013")}</h2>
            <button
              type="button"
              style={{ animationDelay: "240ms" }}
              onClick={toggleHeroVideo}
              aria-label={heroVideoPlaying ? t("home.hero.stopVideo") : t("home.hero.playVideo")}
              className="animate-fade-up mx-auto flex items-center justify-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/70"
            >
              {heroVideoPlaying ? (
                <>
                  <FaRegStopCircle size={26} />
                  <span>{t("home.page.text014")}</span>
                </>
              ) : (
                <>
                  <FaPlayCircle size={26} />
                  <span>{t("home.page.text015")}</span>
                </>
              )}
            </button>
            <div
              className="animate-fade-up flex lg:hidden flex-wrap gap-4 justify-center"
              style={{ animationDelay: "300ms" }}
            >
              <a
                href={routes.agendar}
                className="rounded-full bg-green-base px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-hover shadow-lg shadow-green-base/20"
              >
                {t("home.page.text016")}</a>
            </div>
          </div>

          <div
            id="weekly"
            className="animate-fade-up relative flex min-h-105 scroll-mt-40 flex-col gap-4 rounded-card border border-white/15 bg-white/10 p-5 text-white shadow-[0_25px_60px_rgba(27,26,24,0.18)] backdrop-blur sm:p-6 lg:min-h-[480px]"
            style={{ animationDelay: "100ms" }}
          >
            <SetupWeeklySchedule onSelectClass={goToAgendar} initialBoard={props.initialBoard} />
            {/* <a> plano como en el navbar: con <Link> la segunda vez la URL ya
                es #planes y Next no vuelve a desplazar. */}
            <a
              href="#planes"
              className="shrink-0 cursor-pointer rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-[#1b1a18] shadow-lg shadow-black/30 transition hover:-translate-y-0.5"
            >
              {t("home.page.text017")}</a>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-24 px-6 pb-24">
        <section id="planes" className="scroll-mt-40">
          <div
            className="flex flex-col gap-10"
          >
            <div className="reveal max-w-2xl mt-10">
              <p className="eyebrow eyebrow-on-light">{t("home.page.text018")}</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl font-display">
                {t("home.page.text019")}</h2>
              <p className="mt-3 text-base text-black/70">
                {t("home.page.text020")}<br/>{t("home.page.text021")}</p>
            </div>

            {props.plans.length === 0 ? (
              <p className="reveal text-base text-black/70">
                {t("home.page.text022")}</p>
            ) : (
              <>
                <div className="grid gap-8">
                  {planCards.map((plan, index) => {
                    const image = planCardImage(index);
                    const activePrice =
                      plan.prices.find(
                        (price) => price.label === selectedCadence[plan.id],
                      ) ?? plan.prices[0];

                    return (
                      <article
                        key={plan.id}
                        className="reveal grid grid-cols-1 gap-3 overflow-hidden lg:rounded-card border border-black/10 bg-white/90 shadow-[0_20px_40px_rgba(27,26,24,0.08)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:min-h-[28rem]"
                      >
                        <div className="relative aspect-5/4 w-full overflow-hidden bg-[#d8cfc2] lg:aspect-auto lg:h-full lg:self-stretch">
                          {/* next/image en vez de background-image: AVIF/WebP al
                              tamaño real y carga diferida. Los originales pesan
                              entre 1.8 y 2.8 MB cada uno. */}
                          <Image
                            src={image}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 50vw, 100vw"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex flex-col justify-between gap-6 p-4 sm:p-6">
                          <div className="flex flex-col gap-5">
                            <div>
                              {plan.badge ? (
                                <p className="eyebrow text-green-base">{plan.badge}</p>
                              ) : null}
                              <h3 className="text-xl font-semibold font-display sm:text-2xl">
                                {plan.name}
                              </h3>
                              <p className="mt-2 text-sm font-semibold text-green-base">
                                {activePrice.includes}
                              </p>
                              {plan.note ? (
                                <p className="mt-1 text-sm text-black/60">{plan.note}</p>
                              ) : null}
                            </div>
                            <div className="grid gap-2 text-sm">
                              {plan.prices.map((price) => {
                                const isActive = price.label === activePrice.label;
                                return (
                                  <button
                                    key={price.label}
                                    type="button"
                                    onClick={() =>
                                      setSelectedCadence((prev) => ({
                                        ...prev,
                                        [plan.id]: price.label,
                                      }))
                                    }
                                    aria-pressed={isActive}
                                    className={`flex items-center justify-between gap-2 rounded-inner border px-3 py-2.5 text-left transition sm:px-4 sm:py-3 ${
                                      isActive
                                        ? "border-green-base bg-green-base/10 ring-1 ring-green-base/30"
                                        : "border-black/5 bg-[#f6f1ea]/80 hover:border-green-base/40"
                                    }`}
                                  >
                                    <span className="eyebrow text-black/50">
                                      {price.label}
                                    </span>
                                    <span className="text-lg font-semibold text-green-base">
                                      {price.priceLabel}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {props.loggedIn ? (
                            <SubscribePlanButton
                              planId={activePrice.planId}
                              planName={`${plan.name} ${activePrice.label}`}
                              priceLabel={activePrice.priceLabel}
                              className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-green-base px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-hover"
                            />
                          ) : (
                            <Link
                              href={`${routes.registry}?plan=${activePrice.planId}`}
                              className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-green-base px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-hover"
                            >
                              {t("home.page.text023")}</Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {planBars.map((plan) => (
                  <div
                    key={plan.id}
                    className="reveal flex items-center justify-between lg:rounded-card border border-black/10 bg-white/80 px-6 py-5"
                  >
                    <p className="eyebrow eyebrow-muted">{plan.name}</p>
                    <div className="flex items-center gap-4">
                      <p className="text-2xl font-semibold text-green-base">
                        {plan.prices[0].priceLabel}
                      </p>
                      {/* Las barras son clases sueltas: con sesión se agenda directo. */}
                      <Link
                        href={
                          props.loggedIn
                            ? routes.agendar
                            : `${routes.registry}?plan=${plan.prices[0].planId}`
                        }
                        className="inline-flex shrink-0 items-center justify-center rounded-full bg-green-base px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-hover"
                      >
                        {t("home.page.text024")}</Link>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        <AboutTeam />
        <ContentDetail />
        <section id="quienes-somos" className="scroll-mt-40">
          <div
            className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div className="reveal flex flex-col gap-6">
              <p className="eyebrow eyebrow-on-light">{t("home.page.text025")}</p>
              <h2 className="text-3xl font-semibold leading-tight md:text-4xl font-display">
                {t("home.page.text026")}</h2>
              <p className="text-base text-black/70">
                {t("home.page.text027")}</p>
              <p className="text-base text-black/70">
                {t("home.page.text028")}</p>
              <div className="rounded py-4">
                <p className="text-3xl font-semibold leading-tight md:text-4xl font-display">
                  {t("home.page.text029")}</p>
                <p className="mt-2 text-base text-black/70">
                  {t("home.page.text030")}</p>
              </div>
            </div>

            <div
              className="reveal relative h-80 overflow-hidden rounded-card border border-black/10 bg-[#d8cfc2] shadow-[0_25px_50px_rgba(27,26,24,0.15)] md:h-112 lg:order-last"
            >
              <Image
                src={`${process.env.NEXT_PUBLIC_S3}material.jpg`}
                alt={t("home.page.text031")}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-green-base/40 via-transparent to-transparent" />
            </div>
          </div>
        </section>

        <section id="cobros" className="scroll-mt-40">
          <div
            className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div className="reveal flex flex-col gap-6">
              <p className="eyebrow eyebrow-on-light">{t("home.page.text032")}</p>
              <h2 className="text-3xl font-semibold leading-tight md:text-4xl font-display">
                {t("home.page.text033")}</h2>
              <div
                    key="bank-info"
                    className="reveal flex items-start gap-5 rounded-inner border border-black/5 bg-white/80 px-6 py-5"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-base text-sm font-semibold text-white">
                  <span>{t("home.page.text034")}</span>
                </div>
                <div>
                    <p className="text-base text-black/70">
                      {t("home.page.text035")}</p>
                    <p className="text-base text-black/70">
                      {t("home.page.text036")}</p>
                    <p className="text-base text-black/70">
                      {t("home.page.text037")}</p>
                    <p className="text-base text-black/70">
                      {t("home.page.text038")}</p>
                </div>
              </div>
            </div>

            <div
              className="reveal flex flex-col gap-4 rounded-card border border-black/10 bg-white/90 p-6 shadow-[0_20px_40px_rgba(27,26,24,0.1)]"
            >
              <div>
                <p className="eyebrow eyebrow-muted">{t("home.page.text039")}</p>
                <h3 className="mt-3 text-2xl font-semibold font-display">
                  {t("home.page.text040")}</h3>
              </div>
              <div className="grid gap-3">
                <div className="rounded-inner border border-black/5 bg-white px-5 py-4">
                  <p className="eyebrow text-black/50">{t("home.page.text041")}</p>
                  <p className="text-lg font-semibold">
                    {t("home.page.text042")}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-black/60">
                    <span className="rounded-full bg-[#f6f1ea] px-3 py-1">
                      {t("home.page.text043")}</span>
                    <span className="rounded-full bg-[#f6f1ea] px-3 py-1">
                      {t("home.page.text044")}</span>
                    <span className="rounded-full bg-[#f6f1ea] px-3 py-1">
                      {t("home.page.text045")}</span>
                  </div>
                </div>
              </div>
              <Link
                href={routes.registry}
                className="rounded-full bg-green-base px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-green-base/20 transition hover:-translate-y-0.5 hover:bg-green-hover"
              >
                {t("home.page.text046")}</Link>
            </div>
          </div>
        </section>

        <section id="agenda" className="scroll-mt-40">
          <div
            className="overflow-hidden rounded-card border border-green-base/15 shadow-[0_25px_60px_rgba(27,26,24,0.12)]"
          >
            <div
              className="reveal bg-green-base px-6 py-12 text-center text-white sm:py-16"
            >
              <p className="eyebrow eyebrow-on-dark mx-auto">{t("home.page.text047")}</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight font-display">
                {t("home.page.text048")}</h2>
              <p className="mt-4 text-base text-white/80">
                {t("home.page.text049")}</p>
              <p className="text-base text-white/80">
                {t("home.page.text050")}</p>
            </div>

            <div className="bg-[#f9f0e3] px-6 py-12 sm:py-16">
              <div
                className="reveal mx-auto w-full max-w-md overflow-hidden rounded-card border border-green-base/30 bg-white shadow-[0_20px_40px_rgba(27,26,24,0.1)]"
              >
                <div className="border-b border-green-base/10 bg-green-base/10 px-6 py-5 text-center">
                  <h3 className="text-lg font-semibold text-green-base font-display">
                    {t("home.page.text051")}</h3>
                </div>

                <div className="flex flex-col gap-5 p-6">
                  <p className="text-sm text-black/60">
                    {t("home.page.text052")}</p>
                  <Link
                    href={routes.agendar}
                    className="w-full rounded-full bg-green-base px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-green-base/20 transition hover:bg-green-hover"
                  >
                    {t("home.page.text053")}</Link>
                  <p className="text-center text-xs text-black/50">
                    {t("home.page.text054")}{" "}
                    <Link href="/registry" className="font-semibold text-green-base underline underline-offset-2">
                      {t("home.page.text055")}</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 overflow-hidden border border-white/15">
                <Image
                  src={LOGO_SRC}
                  alt={t("home.page.text056")}
                  fill
                  sizes="64px"
                  className="object-cover shadow-lg shadow-white/20"
                />
              </div>
              <div>
                <p className="text-sm font-semibold">{t("home.page.text057")}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-white/70">
            <p className="text-amber-100">{t("home.page.text058")}</p>
            <a
              href={siteWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-400 transition-colors hover:text-green-300"
            >
              <FaWhatsapp className="size-5" aria-hidden />
              {sitePhoneDisplay}
            </a>
          </div>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <p className="text-amber-100">{t("home.page.text059")}</p>
            <a
              href={siteInstagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition-colors hover:text-white"
            >
              <FaInstagram className="size-5" aria-hidden />
              @{siteInstagramHandle}
            </a>
          </div>
          <div className="flex flex-col">
            <div
              className="mt-4 rounded-card border border-white/10 bg-white/10 p-4 text-sm text-white/70 shadow-[0_20px_40px_rgba(27,26,24,0.1)] backdrop-blur"
            >
              <p className="text-amber-100">{t("home.page.text060")}</p>
              <p>{t("home.page.text061")}</p>
              <div className="mt-3 overflow-hidden rounded-inner border border-white/10">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3795.3043480185247!2d-102.1976358!3d17.964571900000003!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x84315df7e23a5e4d%3A0x52378ed977416fe4!2sStudio%2057%20Pilates%20Reformer%20LZC!5e0!3m2!1ses!2smx!4v1781316731996!5m2!1ses!2smx"
                  width="100%"
                  height="200"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={t("home.page.text062")}
                  className="block w-full grayscale"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-white/70">
            <p className="text-amber-100">{t("home.page.text063")}</p>
            <a href="#planes" className="transition hover:text-white">
              {t("home.page.text064")}</a>
            <a href="#nosotros" className="transition hover:text-white">
              {t("home.page.text065")}</a>
            <a href={routes.agendar} className="transition hover:text-white">
              {t("home.page.text066")}</a>
            <a href="#cobros" className="transition hover:text-white">
              {t("home.page.text067")}</a>
          </div>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <p className="text-amber-100">{t("home.page.text068")}</p>
            <p>
              {t("home.page.text069")}<br /><br />
              {t("home.page.text070")}</p>
            {props.trialUsed ? null : (
              <div className="reveal flex flex-wrap gap-4 justify-center">
                <a
                href={routes.agendar}
                className="rounded-full bg-green-base px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-hover shadow-lg shadow-green-base/20">
                  {t("home.page.text071")}</a>
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
            <p>{t("home.page.text072")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
