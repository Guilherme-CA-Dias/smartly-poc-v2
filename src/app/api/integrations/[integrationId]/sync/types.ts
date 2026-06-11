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

export interface SmartlyUploadConfig {
  destinationPrefix: string;
  libraryId: string;
  apiToken: string;
}

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
  smartlyUpload?: SmartlyUploadConfig;
}

export interface SyncRequestBody {
  integrationId: string;
  integrationKey: string;
  integrationName: string;
  integrationLogo?: string;
  documentIds?: string[];
  smartlyDestinationPrefix?: string;
}
