import { SyncStatus } from "@/models/sync";
import type { AuthCredentials } from "@/lib/auth";

export interface SyncRouteSuccessResponse {
  status: SyncStatus;
}

export interface SyncRouteErrorResponse {
  status: SyncStatus;
  message: string;
}

export type SyncRouteResponse =
  | SyncRouteSuccessResponse
  | SyncRouteErrorResponse;

export interface SyncEventData {
  syncId: string;
  connectionId: string;
  userId: string;
  token: string;
  credentials?: AuthCredentials;
  documentIds?: string[];
  integrationId?: string;
  integrationName?: string;
  integrationLogo?: string;
}

export interface SyncRequestBody {
  integrationId: string;
  integrationName: string;
  integrationLogo?: string;
  documentIds?: string[];
}
