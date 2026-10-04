import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16 escribe AGENTS.md y CLAUDE.md en la raiz al levantar el dev server.
  // Este repo no los usa y sólo aparecen como archivos sin rastrear.
  agentRules: false,
  serverExternalPackages: ["better-sqlite3", "@neondatabase/serverless", "postgres"],
  // Next arrastra sharp y sus binarios de plataforma (@img) por si hay que
  // optimizar imagenes. Con unoptimized nadie los carga, y son ~18 MB del
  // bundle standalone: fuera de la imagen.
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Las imagenes se sirven tal cual desde S3, igual que en refautomex: el pod
    // nunca las toca. El optimizador de Next corria sharp/libvips dentro del
    // contenedor, y decodificar un JPEG de 4592x3448 costaba mas RAM (323 MB en
    // AVIF) que el limite entero del pod (384 Mi), asi que una sola peticion de
    // imagen bastaba para OOMKillearlo. Sin optimizador ese riesgo desaparece
    // por completo, sin importar cuanto pese el original.
    //
    // A cambio, el navegador descarga el archivo original tal como esta en el
    // bucket. Es una decision tomada: se prefiere conservar la calidad de los
    // originales, y el costo queda del lado del cliente, no del pod.
    unoptimized: true,
  },
  async redirects() {
    return []
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default nextConfig
