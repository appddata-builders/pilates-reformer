import { createHmac } from "node:crypto"
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  RevokeTokenCommand,
  type AttributeType,
  type InitiateAuthCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider"
import { CognitoJwtVerifier } from "aws-jwt-verify"

/**
 * Cognito guarda las contraseñas y es la identidad (correo + `sub`); la base
 * guarda todo lo demás (rol, enabled, planes). Es el mismo esquema de
 * refautomex -un user pool por app, el usuario ligado por su `sub`, el ID
 * token verificado con aws-jwt-verify- con dos diferencias:
 *
 * - El app client tiene secret, así que todo corre en el servidor: el
 *   navegador no puede calcular SECRET_HASH sin exponer el secret.
 * - El estudio da de alta cuentas, restablece contraseñas y elimina usuarios.
 *   Eso sólo se puede con las APIs Admin*, que firman con las credenciales
 *   IAM del entorno (AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY).
 */

// Con índice y no con `process.env.NEXT_PUBLIC_...`: Next congela esas
// referencias en el build, y aquí llegan en runtime desde el
// .env.production.secret.
function readEnv(name: string): string {
  return (process.env[name] ?? "").trim()
}

function getConfig() {
  const userPoolId = readEnv("NEXT_PUBLIC_USER_POOL_ID")
  const clientId = readEnv("NEXT_PUBLIC_CLIENT_ID")
  if (userPoolId === "" || clientId === "") {
    throw new Error("Faltan NEXT_PUBLIC_USER_POOL_ID o NEXT_PUBLIC_CLIENT_ID")
  }
  return {
    userPoolId,
    clientId,
    clientSecret: readEnv("COGNITO_CLIENT_SECRET"),
    // El id del pool empieza con su región: us-east-1_XXXXXXXXX.
    region: userPoolId.split("_")[0],
  }
}

let client: CognitoIdentityProviderClient | null = null

function getClient(): CognitoIdentityProviderClient {
  client ??= new CognitoIdentityProviderClient({ region: getConfig().region })
  return client
}

function secretHash(username: string): { SECRET_HASH?: string } {
  const { clientId, clientSecret } = getConfig()
  if (clientSecret === "") return {}
  return {
    SECRET_HASH: createHmac("sha256", clientSecret)
      .update(username + clientId)
      .digest("base64"),
  }
}

function errorName(e: unknown): string {
  return e instanceof Error ? e.name : ""
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : ""
}

// Falta COGNITO_CLIENT_SECRET o no es el del app client: es configuración,
// no una contraseña o un código equivocados.
function isSecretHashError(e: unknown): boolean {
  return errorName(e) === "NotAuthorizedException" && /secret.?hash/i.test(errorMessage(e))
}

// --------------------------------------------------------------- errores ---

export class EmailTakenError extends Error {
  constructor() {
    super("El correo ya está registrado")
    this.name = "EmailTakenError"
  }
}

export class CognitoPasswordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CognitoPasswordError"
  }
}

// Cognito responde en inglés con la regla que falló de la política del pool.
function passwordPolicyMessage(raw: string): string {
  const text = raw.toLowerCase()
  if (text.includes("previously been used")) return "Esa contraseña ya se usó antes; escoge otra"
  if (text.includes("long enough")) return "La contraseña es demasiado corta"
  if (text.includes("uppercase")) return "La contraseña debe incluir mayúsculas"
  if (text.includes("lowercase")) return "La contraseña debe incluir minúsculas"
  if (text.includes("numeric")) return "La contraseña debe incluir números"
  if (text.includes("symbol")) return "La contraseña debe incluir símbolos"
  return "La contraseña no cumple la política de seguridad"
}

function toAdminError(e: unknown, action: string): Error {
  switch (errorName(e)) {
    case "InvalidPasswordException":
      return new CognitoPasswordError(passwordPolicyMessage(errorMessage(e)))
    case "UsernameExistsException":
    case "AliasExistsException":
      return new EmailTakenError()
    case "UserNotFoundException":
      return new Error("Este usuario no tiene cuenta de acceso en Cognito")
  }
  console.error(`[cognito] No se pudo ${action}:`, e)
  return new Error(`No se pudo ${action} en Cognito. Intenta de nuevo en unos minutos.`)
}

// ----------------------------------------------------------------- login ---

export type CognitoSignInFailure =
  | "credentials"
  | "disabled"
  | "unconfirmed"
  | "reset_required"
  | "temporary_password"
  | "too_many_attempts"
  | "unavailable"

export type CognitoTokens = { idToken: string; refreshToken: string | null }

export type CognitoSignInResult =
  | ({ ok: true } & CognitoTokens)
  | { ok: false; reason: CognitoSignInFailure }

function isFlowNotEnabled(e: unknown): boolean {
  return errorName(e) === "InvalidParameterException" && /not enabled/i.test(errorMessage(e))
}

async function initiatePasswordAuth(
  username: string,
  password: string,
): Promise<InitiateAuthCommandOutput> {
  const { clientId } = getConfig()
  const params = { USERNAME: username, PASSWORD: password, ...secretHash(username) }
  try {
    return await getClient().send(
      new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: params,
      }),
    )
  } catch (e) {
    if (!isFlowNotEnabled(e)) throw e
    // Sin ALLOW_USER_PASSWORD_AUTH en el app client, el inicio "basado en
    // opciones" (ALLOW_USER_AUTH) acepta la contraseña directa.
    return await getClient().send(
      new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: "USER_AUTH",
        AuthParameters: { ...params, PREFERRED_CHALLENGE: "PASSWORD" },
      }),
    )
  }
}

/** Valida correo y contraseña contra el user pool y devuelve el ID token. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<CognitoSignInResult> {
  try {
    const out = await initiatePasswordAuth(email, password)
    const idToken = out.AuthenticationResult?.IdToken
    if (idToken) {
      return { ok: true, idToken, refreshToken: out.AuthenticationResult?.RefreshToken ?? null }
    }
    // Cuenta creada desde la consola con contraseña temporal. Cognito no deja
    // usar "olvidé mi contraseña" en ese estado; el reset del estudio sí.
    if (out.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      return { ok: false, reason: "temporary_password" }
    }
    console.error("[cognito] Reto de login no soportado:", out.ChallengeName)
    return { ok: false, reason: "unavailable" }
  } catch (e) {
    switch (isSecretHashError(e) ? "" : errorName(e)) {
      case "NotAuthorizedException": {
        const msg = errorMessage(e).toLowerCase()
        if (msg.includes("disabled")) return { ok: false, reason: "disabled" }
        if (msg.includes("attempts exceeded")) return { ok: false, reason: "too_many_attempts" }
        return { ok: false, reason: "credentials" }
      }
      case "UserNotFoundException":
        return { ok: false, reason: "credentials" }
      case "UserNotConfirmedException":
        return { ok: false, reason: "unconfirmed" }
      case "PasswordResetRequiredException":
        return { ok: false, reason: "reset_required" }
      case "TooManyRequestsException":
      case "LimitExceededException":
        return { ok: false, reason: "too_many_attempts" }
    }
    console.error("[cognito] Falló el login:", e)
    return { ok: false, reason: "unavailable" }
  }
}

// ---------------------------------------------------------------- sesión ---

/**
 * Renueva el ID token. `username` es el claim `cognito:username` del token
 * vencido: Cognito calcula el SECRET_HASH del refresh con ese y no con el
 * correo. Devuelve null si el refresh token ya no sirve (venció o se revocó);
 * lanza si Cognito no contestó, para no cerrar la sesión por un tropiezo.
 */
export async function refreshCognitoSession(
  refreshToken: string,
  username: string,
): Promise<CognitoTokens | null> {
  try {
    const out = await getClient().send(
      new InitiateAuthCommand({
        ClientId: getConfig().clientId,
        AuthFlow: "REFRESH_TOKEN_AUTH",
        AuthParameters: { REFRESH_TOKEN: refreshToken, ...secretHash(username) },
      }),
    )
    const idToken = out.AuthenticationResult?.IdToken
    if (!idToken) return null
    // Con rotación de refresh tokens activa, Cognito entrega uno nuevo.
    return { idToken, refreshToken: out.AuthenticationResult?.RefreshToken ?? null }
  } catch (e) {
    if (errorName(e) === "NotAuthorizedException" && !isSecretHashError(e)) return null
    throw e
  }
}

/** Cierra la sesión de este dispositivo. No falla: las cookies se borran igual. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const { clientId, clientSecret } = getConfig()
  try {
    await getClient().send(
      new RevokeTokenCommand({
        Token: refreshToken,
        ClientId: clientId,
        ...(clientSecret !== "" ? { ClientSecret: clientSecret } : {}),
      }),
    )
  } catch (e) {
    console.error("[cognito] No se pudo revocar el refresh token:", e)
  }
}

/**
 * Revoca todos los refresh tokens de la cuenta. Los ID tokens vigentes los
 * corta `sessions_revoked_at` (lib/revoke-user-sessions.ts).
 */
export async function signOutCognitoUserEverywhere(username: string): Promise<void> {
  try {
    await getClient().send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: getConfig().userPoolId, Username: username }),
    )
  } catch (e) {
    if (errorName(e) === "UserNotFoundException") return
    console.error("[cognito] No se pudo cerrar la sesión en todos los dispositivos:", e)
  }
}

// --------------------------------------------------- olvidé mi contraseña ---

/**
 * Cognito manda el código por correo desde su remitente por defecto
 * (no-reply@verificationemail.com); el texto se edita en la consola, en
 * "Message templates". No falla: quien lo pide siempre ve el mismo mensaje,
 * exista o no la cuenta.
 */
export async function sendPasswordResetCode(email: string): Promise<void> {
  try {
    await getClient().send(
      new ForgotPasswordCommand({
        ClientId: getConfig().clientId,
        Username: email,
        SecretHash: secretHash(email).SECRET_HASH,
      }),
    )
  } catch (e) {
    console.error("[cognito] No se pudo enviar el código de recuperación:", e)
  }
}

export type ConfirmPasswordResetResult =
  | { ok: true }
  | { ok: false; reason: "code" | "password" | "too_many_attempts" | "unavailable"; message?: string }

export async function confirmPasswordReset(
  email: string,
  code: string,
  password: string,
): Promise<ConfirmPasswordResetResult> {
  try {
    await getClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: getConfig().clientId,
        Username: email,
        ConfirmationCode: code,
        Password: password,
        SecretHash: secretHash(email).SECRET_HASH,
      }),
    )
    return { ok: true }
  } catch (e) {
    switch (isSecretHashError(e) ? "" : errorName(e)) {
      case "InvalidPasswordException":
        return { ok: false, reason: "password", message: passwordPolicyMessage(errorMessage(e)) }
      case "CodeMismatchException":
      case "ExpiredCodeException":
      case "UserNotFoundException":
      case "NotAuthorizedException":
        return { ok: false, reason: "code" }
      case "LimitExceededException":
      case "TooManyFailedAttemptsException":
      case "TooManyRequestsException":
        return { ok: false, reason: "too_many_attempts" }
    }
    console.error("[cognito] Falló el cambio de contraseña con código:", e)
    return { ok: false, reason: "unavailable" }
  }
}

// Se crea en la primera petición y no al importar: `next build` importa las
// rutas sin las variables de runtime.
let verifier: ReturnType<typeof createVerifier> | null = null

function createVerifier() {
  const { userPoolId, clientId } = getConfig()
  return CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: "id" })
}

/**
 * Verifica firma, emisor, audiencia y vigencia del ID token. Leer el payload
 * no basta: cualquiera puede armar uno.
 */
export async function verifyCognitoIdToken(token: string) {
  verifier ??= createVerifier()
  return verifier.verify(token)
}

// ----------------------------------------------------------------- admin ---

function subFromAttributes(attributes: AttributeType[] | undefined): string | null {
  return attributes?.find((a) => a.Name === "sub")?.Value ?? null
}

/**
 * `username` puede ser el correo o el `sub`: las APIs Admin* aceptan
 * cualquiera de los dos. Devuelve null si la cuenta no existe.
 */
export async function findCognitoSub(username: string): Promise<string | null> {
  try {
    const out = await getClient().send(
      new AdminGetUserCommand({ UserPoolId: getConfig().userPoolId, Username: username }),
    )
    return subFromAttributes(out.UserAttributes)
  } catch (e) {
    if (errorName(e) === "UserNotFoundException") return null
    throw toAdminError(e, "consultar la cuenta")
  }
}

/** Crea la cuenta sin contraseña utilizable; falta `setCognitoPassword`. */
export async function createCognitoUser(params: {
  email: string
  name: string
}): Promise<string> {
  try {
    const out = await getClient().send(
      new AdminCreateUserCommand({
        UserPoolId: getConfig().userPoolId,
        Username: params.email,
        UserAttributes: [
          { Name: "email", Value: params.email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: params.name },
        ],
        // La contraseña la comparte el estudio o la escoge quien se registra:
        // Cognito no debe mandar su propio correo con una temporal.
        MessageAction: "SUPPRESS",
      }),
    )
    const sub = subFromAttributes(out.User?.Attributes)
    if (sub == null) throw new Error("Cognito no devolvió el sub de la cuenta nueva")
    return sub
  } catch (e) {
    throw toAdminError(e, "crear la cuenta")
  }
}

export async function updateCognitoUser(
  username: string,
  attributes: { email?: string; name?: string },
): Promise<void> {
  const list: AttributeType[] = []
  if (attributes.email != null) {
    list.push({ Name: "email", Value: attributes.email })
    // Sin esto Cognito deja el correo anterior activo hasta que se verifique.
    list.push({ Name: "email_verified", Value: "true" })
  }
  if (attributes.name != null) list.push({ Name: "name", Value: attributes.name })
  if (list.length === 0) return

  try {
    await getClient().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: getConfig().userPoolId,
        Username: username,
        UserAttributes: list,
      }),
    )
  } catch (e) {
    throw toAdminError(e, "actualizar la cuenta")
  }
}

/** Contraseña permanente: la cuenta queda confirmada y sin reto al entrar. */
export async function setCognitoPassword(username: string, password: string): Promise<void> {
  try {
    await getClient().send(
      new AdminSetUserPasswordCommand({
        UserPoolId: getConfig().userPoolId,
        Username: username,
        Password: password,
        Permanent: true,
      }),
    )
  } catch (e) {
    throw toAdminError(e, "guardar la contraseña")
  }
}

/**
 * No falla: el usuario ya se borró de la base, y si la cuenta queda huérfana
 * en Cognito el siguiente alta con ese correo la reutiliza.
 */
export async function deleteCognitoUser(username: string): Promise<void> {
  try {
    await getClient().send(
      new AdminDeleteUserCommand({ UserPoolId: getConfig().userPoolId, Username: username }),
    )
  } catch (e) {
    if (errorName(e) === "UserNotFoundException") return
    console.error("[cognito] No se pudo eliminar la cuenta:", e)
  }
}
