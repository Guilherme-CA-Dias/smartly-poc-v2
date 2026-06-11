import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/server-auth";

const INTEGRATION_APP_API = "https://api.integration.app";

async function triggerFlowRuns(token: string, integrationKey: string, documentIds: string[]) {
  await Promise.all(
    documentIds.map((documentId) =>
      fetch(
        `${INTEGRATION_APP_API}/flows/download-content-item/run?layer=connection&integrationKey=${integrationKey}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: { documentId } }),
        }
      ).then((res) => {
        if (!res.ok) {
          return res.text().then((msg) => {
            console.error(`Flow run failed for document ${documentId}:`, msg);
          });
        }
      })
    )
  );
}
import { generateCustomerAccessToken } from "@/lib/integration-token";
import connectDB from "@/lib/mongodb";
import { SyncModel, SyncStatus } from "@/models/sync";
import { SyncEventData, SyncRequestBody, SyncRouteResponse } from "./types";
import { syncDocuments } from "./syncDocuments";
import { uploadDocsToSmartly } from "./uploadDocsToSmartly";
import { DocumentModel } from "@/models/document";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
): Promise<NextResponse<SyncRouteResponse>> {
  try {
    const connectionId = (await params).integrationId;
    const { integrationId, integrationKey, integrationName, integrationLogo, documentIds, smartlyDestinationPrefix } =
      (await request.json()) as SyncRequestBody;

    const auth = getAuthFromRequest(request);
    const token = await generateCustomerAccessToken(auth);

    await connectDB();

    const userId = auth.customerId;

    const { libraryId, apiToken } = (auth.credentials ?? {}) as { libraryId?: string; apiToken?: string };
    const smartlyUpload =
      smartlyDestinationPrefix !== undefined && libraryId && apiToken
        ? { destinationPrefix: smartlyDestinationPrefix, libraryId, apiToken }
        : undefined;

    // Create a new sync record
    const sync = await SyncModel.create({
      userId,
      connectionId,
      integrationId,
      integrationName,
      integrationLogo,
      syncStatus: SyncStatus.in_progress,
      syncStartedAt: new Date(),
      syncError: null,
      isTruncated: false,
      documentIds,
      smartlyUpload,
    });

    const eventData = {
      connectionId,
      token,
      userId: auth.customerId,
      credentials: auth.credentials,
      documentIds,
      syncId: sync._id.toString(),
      smartlyUpload,
    } satisfies SyncEventData;

    syncDocuments(eventData).catch(console.error);

    if (documentIds && documentIds.length > 0) {
      triggerFlowRuns(token, integrationKey, documentIds).catch(console.error);

      if (smartlyUpload) {
        uploadDocsToSmartly({
          connectionId,
          token,
          credentials: auth.credentials,
          documentIds,
          ...smartlyUpload,
        }).catch(console.error);
      }
    }

    return NextResponse.json({ status: SyncStatus.in_progress });
  } catch (error) {
    console.error("Failed to start sync:", error);
    return NextResponse.json(
      { status: SyncStatus.failed, message: "Failed to start sync" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const connectionId = (await params).integrationId;
    await connectDB();

    // Delete all sync records for this connection
    await SyncModel.deleteMany({ connectionId });

    // Delete all documents for this connection
    await DocumentModel.deleteMany({ connectionId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete sync data:", error);
    return NextResponse.json(
      { error: "Failed to delete sync data" },
      { status: 500 }
    );
  }
}
