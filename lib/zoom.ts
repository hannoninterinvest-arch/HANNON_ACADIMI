import { getZoomEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  CreateZoomMeetingInput,
  UpdateZoomMeetingInput,
  ZoomErrorBody,
  ZoomMeeting,
  ZoomTokenResponse,
} from "@/lib/zoom.types";

const ZOOM_OAUTH_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";
const TOKEN_SKEW_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

export class ZoomApiError extends Error {
  public readonly status: number;
  public readonly code: number | undefined;
  public readonly retryable: boolean;
  public readonly compteOccupe: boolean;
  public readonly rateLimited: boolean;

  constructor(params: {
    message: string;
    status: number;
    code?: number;
    retryable?: boolean;
    compteOccupe?: boolean;
    rateLimited?: boolean;
  }) {
    super(params.message);
    this.name = "ZoomApiError";
    this.status = params.status;
    this.code = params.code;
    this.retryable = params.retryable ?? false;
    this.compteOccupe = params.compteOccupe ?? false;
    this.rateLimited = params.rateLimited ?? false;
  }
}

function classifyZoomError(status: number, body: ZoomErrorBody | undefined): ZoomApiError {
  const code = body?.code;
  const message = body?.message ?? `Erreur Zoom HTTP ${status}`;
  const rateLimited = status === 429;
  // 429 / 1010 / certains codes "user is in another meeting"
  const compteOccupe =
    code === 1115 ||
    code === 3000 ||
    /already in a meeting|host is in another meeting|not available/i.test(message);

  const retryable = rateLimited || status >= 500 || code === 124;

  return new ZoomApiError({
    message: `[Zoom API] ${message}`,
    status,
    code,
    retryable,
    compteOccupe,
    rateLimited,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function isTokenResponse(value: unknown): value is ZoomTokenResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.access_token === "string" && typeof record.expires_in === "number";
}

function isErrorBody(value: unknown): value is ZoomErrorBody {
  return typeof value === "object" && value !== null;
}

async function fetchAccessToken(): Promise<TokenCache> {
  const { accountId, clientId, clientSecret } = getZoomEnv();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const url = `${ZOOM_OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const body = await parseJsonSafe(response);
  if (!response.ok || !isTokenResponse(body)) {
    const errorBody = isErrorBody(body) ? body : undefined;
    const error = classifyZoomError(response.status, errorBody);
    logger.error("Échec de l'obtention du token Zoom", {
      status: response.status,
      code: error.code,
      zoomMessage: errorBody?.message,
    });
    throw error;
  }

  const expiresAtMs = Date.now() + body.expires_in * 1000;
  logger.info("Token Zoom Server-to-Server obtenu", {
    expiresIn: body.expires_in,
    scope: body.scope,
  });
  return { accessToken: body.access_token, expiresAtMs };
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && tokenCache && now < tokenCache.expiresAtMs - TOKEN_SKEW_MS) {
    return tokenCache.accessToken;
  }
  tokenCache = await fetchAccessToken();
  return tokenCache.accessToken;
}

export function resetZoomTokenCache(): void {
  tokenCache = null;
}

type ZoomRequestOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
};

async function zoomRequest<T>(options: ZoomRequestOptions): Promise<T | undefined> {
  let token = await getAccessToken();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${ZOOM_API_BASE}${options.path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 204) {
      return undefined;
    }

    const parsed = await parseJsonSafe(response);

    if (response.ok) {
      return parsed as T;
    }

    const errorBody = isErrorBody(parsed) ? parsed : undefined;
    const error = classifyZoomError(response.status, errorBody);

    if (error.code === 124 && attempt < MAX_RETRIES) {
      logger.warn("Token Zoom invalide (124), renouvellement", { attempt });
      token = await getAccessToken(true);
      continue;
    }

    if (error.rateLimited && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : 500 * 2 ** (attempt - 1);
      logger.warn("Rate limit Zoom (429), nouvel essai", {
        attempt,
        waitMs,
        path: options.path,
      });
      await sleep(waitMs);
      continue;
    }

    if (error.retryable && attempt < MAX_RETRIES) {
      const waitMs = 400 * 2 ** (attempt - 1);
      logger.warn("Erreur Zoom transitoire, nouvel essai", {
        attempt,
        status: error.status,
        code: error.code,
        path: options.path,
      });
      await sleep(waitMs);
      continue;
    }

    logger.error("Appel Zoom API en échec", {
      method: options.method,
      path: options.path,
      status: error.status,
      code: error.code,
      zoomMessage: errorBody?.message,
      compteOccupe: error.compteOccupe,
      rateLimited: error.rateLimited,
    });
    throw error;
  }

  throw new ZoomApiError({
    message: "[Zoom API] Nombre maximal de tentatives atteint",
    status: 503,
    retryable: true,
  });
}

function isZoomMeeting(value: unknown): value is ZoomMeeting {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "number" && typeof record.join_url === "string";
}

export async function createMeeting(input: CreateZoomMeetingInput): Promise<ZoomMeeting> {
  const body = {
    topic: input.topic,
    type: 2,
    start_time: input.startTime,
    duration: input.durationMinutes,
    timezone: input.timezone,
    agenda: input.agenda,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: true,
      waiting_room: false,
      mute_upon_entry: true,
      meeting_authentication: false,
    } satisfies Record<string, boolean>,
  };

  const created = await zoomRequest<ZoomMeeting>({
    method: "POST",
    path: `/users/${encodeURIComponent(input.zoomUserId)}/meetings`,
    body,
  });

  if (!isZoomMeeting(created)) {
    logger.error("Réponse Zoom createMeeting inattendue", { created });
    throw new ZoomApiError({
      message: "[Zoom API] Réponse createMeeting invalide (join_url manquant)",
      status: 502,
    });
  }

  logger.info("Réunion Zoom créée", {
    meetingId: created.id,
    zoomUserId: input.zoomUserId,
    startTime: input.startTime,
  });
  return created;
}

export async function updateMeeting(
  meetingId: string,
  input: UpdateZoomMeetingInput,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (input.topic !== undefined) body.topic = input.topic;
  if (input.startTime !== undefined) body.start_time = input.startTime;
  if (input.durationMinutes !== undefined) body.duration = input.durationMinutes;
  if (input.timezone !== undefined) body.timezone = input.timezone;
  if (input.agenda !== undefined) body.agenda = input.agenda;

  await zoomRequest({
    method: "PATCH",
    path: `/meetings/${encodeURIComponent(meetingId)}`,
    body,
  });
  logger.info("Réunion Zoom mise à jour", { meetingId });
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  try {
    await zoomRequest({
      method: "DELETE",
      path: `/meetings/${encodeURIComponent(meetingId)}?schedule_for_reminder=false`,
    });
    logger.info("Réunion Zoom supprimée", { meetingId });
  } catch (error) {
    if (error instanceof ZoomApiError && (error.status === 404 || error.code === 3001 || error.code === 3002)) {
      logger.warn("Réunion Zoom déjà absente lors de la suppression", {
        meetingId,
        status: error.status,
        code: error.code,
      });
      return;
    }
    throw error;
  }
}

export async function getMeeting(meetingId: string): Promise<ZoomMeeting> {
  const meeting = await zoomRequest<ZoomMeeting>({
    method: "GET",
    path: `/meetings/${encodeURIComponent(meetingId)}`,
  });
  if (!isZoomMeeting(meeting)) {
    throw new ZoomApiError({
      message: "[Zoom API] Réponse getMeeting invalide",
      status: 502,
    });
  }
  return meeting;
}

/**
 * Zoom n'expose plus le host_key en GET. On le pose nous-mêmes (6-10 chiffres)
 * et on le stocke en base pour le transmettre au formateur.
 */
export async function setUserHostKey(zoomUserId: string, hostKey: string): Promise<void> {
  if (!/^\d{6,10}$/.test(hostKey)) {
    throw new Error("host_key Zoom invalide : 6 à 10 chiffres requis");
  }
  await zoomRequest({
    method: "PATCH",
    path: `/users/${encodeURIComponent(zoomUserId)}`,
    body: { host_key: hostKey },
  });
  logger.info("Host key Zoom positionnée sur le compte du pool", { zoomUserId });
}

export function genererHostKey(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}
