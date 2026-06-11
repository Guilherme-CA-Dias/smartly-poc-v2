import { IntegrationAppClient } from "@integration-app/sdk";
import { DocumentModel, Document } from "@/models/document";
import { SyncModel, SyncStatus } from "@/models/sync";
import connectDB from "@/lib/mongodb";
import { withTimeout } from "@/lib/timeout";
import { SyncEventData } from "./types";

interface ListDocumentsActionRecord {
  fields: Exclude<Document, "connectionId" | "content" | "userId">;
}

interface DocumentsResponse {
  output: {
    records: ListDocumentsActionRecord[];
    cursor?: string;
  };
}

function isConnectionNotFoundError(error: unknown, connectionId: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes(`Connection "${connectionId}" not found`)
  );
}

const FETCH_PAGE_TIMEOUT = 60000;
const MAX_DOCUMENTS = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function performSync(eventData: SyncEventData): Promise<void> {
  const { syncId, connectionId, userId, token, credentials, documentIds, smartlyUpload } = eventData;

  if (!documentIds || documentIds.length === 0) {
    throw new Error("No document IDs provided for sync");
  }

  const integrationApp = new IntegrationAppClient({ token, credentials });
  const documentsToSync: Array<Exclude<Document, "connectionId" | "content" | "userId">> = [];

  for (const documentId of documentIds) {
    const rootDocResult = await (async () => {
      try {
        return await withTimeout(
          integrationApp
            .connection(connectionId)
            .action("find-content-item-by-id")
            .run({ id: documentId }) as Promise<{
            output: { fields: Exclude<Document, "connectionId" | "content" | "userId"> };
          }>,
          FETCH_PAGE_TIMEOUT,
          `Fetching root document ${documentId} timed out after ${FETCH_PAGE_TIMEOUT / 1000}s`
        );
      } catch (error) {
        if (isConnectionNotFoundError(error, connectionId)) {
          throw new Error(`Connection "${connectionId}" was archived during sync process`);
        }
        throw error;
      }
    })();

    const rootDocumentFields = rootDocResult.output.fields;
    documentsToSync.push(rootDocumentFields);

    if (rootDocumentFields.canHaveChildren) {
      let cursor: string | undefined;

      while (documentsToSync.length < MAX_DOCUMENTS) {
        const result = await (async () => {
          try {
            return await withTimeout(
              integrationApp
                .connection(connectionId)
                .action("list-content-items")
                .run(cursor ? { cursor } : { parentId: documentId, recursive: true }) as Promise<DocumentsResponse>,
              FETCH_PAGE_TIMEOUT,
              `Fetching children for ${documentId} timed out after ${FETCH_PAGE_TIMEOUT / 1000}s`
            );
          } catch (error) {
            if (isConnectionNotFoundError(error, connectionId)) {
              throw new Error(`Connection "${connectionId}" was archived during sync process`);
            }
            throw error;
          }
        })();

        documentsToSync.push(...result.output.records.map((r) => r.fields));
        cursor = result.output.cursor;
        if (!cursor) break;
      }
    }

    if (documentsToSync.length >= MAX_DOCUMENTS) break;
  }

  const docsToSave = documentsToSync.slice(0, MAX_DOCUMENTS).map((doc) => ({
    ...doc,
    connectionId,
    content: null,
    userId,
    ...(smartlyUpload && doc.canDownload ? { smartlyUpload } : {}),
  }));

  if (docsToSave.length > 0) {
    await DocumentModel.bulkWrite(
      docsToSave.map((doc) => ({
        updateOne: {
          filter: { id: doc.id, connectionId },
          update: { $set: doc },
          upsert: true,
        },
      }))
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const existingSync = await SyncModel.findById(syncId);
  if (!existingSync) {
    throw new Error(`Sync "${syncId}" was deleted during sync`);
  }

  await SyncModel.findByIdAndUpdate(syncId, {
    $set: {
      syncStatus: SyncStatus.completed,
      syncCompletedAt: new Date(),
      syncError: null,
      isTruncated: documentsToSync.length >= MAX_DOCUMENTS,
      actualSyncedDocumentIds: docsToSave.map((doc) => doc.id),
    },
  });
}

export async function syncDocuments(eventData: SyncEventData): Promise<void> {
  await connectDB();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await performSync(eventData);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isLastAttempt = attempt === MAX_RETRIES;

      await SyncModel.findByIdAndUpdate(eventData.syncId, {
        $set: {
          retryCount: attempt,
          syncError: errorMessage,
          ...(isLastAttempt
            ? { syncStatus: SyncStatus.failed, syncCompletedAt: new Date() }
            : { syncStatus: SyncStatus.in_progress }),
        },
      });

      if (isLastAttempt) return;

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    }
  }
}
