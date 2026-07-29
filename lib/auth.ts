import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { getTrustedOrigins } from "@/lib/auth-trusted-origins"
import { getAuthDb, getAuthProvider, getAuthSchema, getDb } from "@/lib/db"
import {
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  sendPasswordResetEmail,
} from "@/lib/password-reset"
import { createNotification } from "@/lib/notifications"

const db = getAuthDb()

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: getTrustedOrigins(),
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "alumno" },
      phone: { type: "string", required: false },
      displayId: { type: "string", required: false },
      idPrefix: { type: "string", required: false, defaultValue: "ST" },
      birthdate: { type: "string", required: false },
      notes: { type: "string", required: false },
      enabled: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
    changeEmail: { enabled: true },
    deleteUser: { enabled: true },
  },
  database: drizzleAdapter(db, {
    provider: getAuthProvider(),
    schema: getAuthSchema(),
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      // Una cuenta inhabilitada no debe poder recuperarse sola.
      if ((user as { enabled?: boolean }).enabled === false) return
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name?.trim() || "Usuario",
        token,
      })
    },
    onPasswordReset: async ({ user }) => {
      await createNotification(getDb(), {
        userId: user.id,
        type: "password_reset",
        title: "Contraseña actualizada",
        body: `Hola ${user.name?.trim() || "Usuario"}, tu contraseña se cambió desde el enlace de recuperación. Si no fuiste tú, avisa al estudio de inmediato.`,
      })
    },
  },
  plugins: [nextCookies()],
})
