export type ZoomTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  api_url?: string;
};

export type ZoomErrorBody = {
  code?: number;
  message?: string;
};

export type ZoomMeetingType = 1 | 2 | 3 | 8;

export type ZoomMeetingSettings = {
  host_video?: boolean;
  participant_video?: boolean;
  join_before_host?: boolean;
  waiting_room?: boolean;
  mute_upon_entry?: boolean;
  meeting_authentication?: boolean;
};

export type CreateZoomMeetingInput = {
  zoomUserId: string;
  topic: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  agenda?: string;
};

export type UpdateZoomMeetingInput = {
  topic?: string;
  startTime?: string;
  durationMinutes?: number;
  timezone?: string;
  agenda?: string;
};

export type ZoomMeeting = {
  uuid: string;
  id: number;
  host_id: string;
  host_email?: string;
  topic: string;
  type: ZoomMeetingType;
  status?: string;
  start_time?: string;
  duration?: number;
  timezone?: string;
  agenda?: string;
  created_at?: string;
  start_url?: string;
  join_url: string;
  password?: string;
  settings?: ZoomMeetingSettings;
};

export type ZoomWebhookEventName =
  | "endpoint.url_validation"
  | "meeting.started"
  | "meeting.ended"
  | string;

export type ZoomWebhookMeetingObject = {
  id: string | number;
  uuid?: string;
  host_id?: string;
  topic?: string;
  type?: number;
  start_time?: string;
  duration?: number;
  timezone?: string;
};

export type ZoomWebhookPayload = {
  account_id?: string;
  operator?: string;
  object?: ZoomWebhookMeetingObject;
  plainToken?: string;
};

export type ZoomWebhookEvent = {
  event: ZoomWebhookEventName;
  event_ts?: number;
  payload: ZoomWebhookPayload;
};
