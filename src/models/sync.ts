import { Schema, model, models } from "mongoose";

export const SyncStatus = {
  in_progress: "in_progress",
  completed: "completed",
  failed: "failed",
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export interface SmartlyUploadConfig {
  destinationPrefix: string;
  libraryId: string;
  apiToken: string;
}

export interface Sync {
  userId: string;
  connectionId: string;
  integrationId: string;
  integrationName: string;
  integrationLogo?: string;
  syncStatus?: SyncStatus;
  syncStartedAt?: Date;
  syncCompletedAt?: Date;
  syncError?: string;
  isTruncated?: boolean;
  retryCount?: number;
  documentIds?: string[];
  actualSyncedDocumentIds?: string[];
  smartlyUpload?: SmartlyUploadConfig;
  createdAt: Date;
  updatedAt: Date;
}

const syncSchema = new Schema<Sync>(
  {
    userId: {
      type: String,
      required: true,
    },
    connectionId: {
      type: String,
      required: true,
    },
    integrationId: {
      type: String,
      required: true,
    },
    integrationName: {
      type: String,
      required: true,
    },
    integrationLogo: String,
    syncStatus: {
      type: String,
      enum: Object.values(SyncStatus),
    },
    syncStartedAt: Date,
    syncCompletedAt: Date,
    syncError: String,
    isTruncated: {
      type: Boolean,
      default: false,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    documentIds: [String],
    actualSyncedDocumentIds: [String],
    smartlyUpload: {
      type: {
        destinationPrefix: String,
        libraryId: String,
        apiToken: String,
      },
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for querying syncs by user and connection
syncSchema.index({ userId: 1, connectionId: 1 });
// Index for querying latest syncs
syncSchema.index({ connectionId: 1, createdAt: -1 });

// Recreate model if it exists
if (models?.Sync) {
  delete models.Sync;
}

export const SyncModel = model<Sync>("Sync", syncSchema);
