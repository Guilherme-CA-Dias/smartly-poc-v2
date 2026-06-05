# Content Import App

A Next.js application that imports content from third-party integrations (Google Drive, Dropbox, Box, etc.) and Smartly asset libraries into a knowledge base using [Membrane](https://getmembrane.com) (powered by Integration.app).

---

## How it works

### 1. Customer setup (Overview page)

On first load, the app generates a random customer ID stored in localStorage. This ID is used to generate a signed JWT that authenticates the current user with Membrane.

Before connecting any integration, the user enters their **Smartly credentials** on the Overview page:

| Field | Purpose |
|---|---|
| `libraryId` | Smartly library (bucket) to read/write assets from |
| `apiToken` | Smartly API token (generated under _My Profile → API Tokens_) |

These credentials are stored in localStorage and passed to the Membrane SDK on initialization via `IntegrationAppProvider credentials={...}`, so Membrane can authenticate requests it makes to the Smartly FileStore API on the user's behalf.

---

### 2. Connecting an integration (Integrations page)

The Integrations page lists all available integrations. Users can:

- **Connect** an integration via OAuth or client credentials
- **Browse** all available integrations via the pre-built Membrane embedded UI (`integrationApp.open()`)
- **Manage flow instances** — enable or disable individual flows per integration via the Flows dialog
- **View sync history** for each connected integration

---

### 3. Selecting and syncing documents

Once an integration is connected, clicking **Select Files** opens a document picker that fetches the folder/file tree from the integration. The user selects which documents to sync and clicks **Sync**.

This triggers two parallel background operations:

**a) Document metadata sync**

A sync record is created in MongoDB with status `in_progress`. A background job (`syncDocuments`) then:
1. Fetches each selected document (and its children if it's a folder) via the Membrane SDK
2. Saves all document metadata to MongoDB via bulk upsert
3. Updates the sync record to `completed` (or `failed` after 3 retries with exponential backoff: 1s → 2s → 4s)

**b) Flow runs**

For each selected document, a `download-content-item` flow run is triggered via the Membrane API:

```
POST /flows/download-content-item/run?layer=connection&integrationKey={key}
{ "input": { "documentId": "..." } }
```

One request per document, all fired in parallel.

---

### 4. Smartly Files picker

The **Smartly Files** tab on any connected integration opens a file picker that browses and sends assets from the Smartly FileStore API (S3-compatible). The flow has three steps:

**Step 1 — List (`list-smartly-files`)**

Lists objects in the Smartly library. Supports folder navigation via prefix + delimiter:

```json
{
  "prefix": "folder/",
  "delimiter": "/",
  "maxKeys": 500,
  "continuationToken": "..."
}
```

The XML response is parsed into files (`<Contents>`) and folders (`<CommonPrefixes>`). Clicking a folder re-calls the action with its prefix.

**Step 2 — Get (`get-smartly-files`)**

For each selected asset key, retrieves the binary content:

```json
{ "assetPath": "folder/image.jpg" }
```

The binary is then uploaded to the Membrane Files endpoint to get a stable, addressable download URL:

```
POST https://api.getmembrane.com/files
Authorization: Bearer <integration-token>
Content-Type: application/octet-stream
→ { "downloadUri": "https://..." }
```

**Step 3 — Send (`send-files`)**

Sends the asset to its destination using the Membrane download URL (avoids passing raw binary through the action system):

```json
{
  "assetPath": "folder/image.jpg",
  "downloadUrl": "https://api.getmembrane.com/files/..."
}
```

All files are processed sequentially. The integration token is fetched once before the loop.

---

### 5. Webhook events

Membrane calls your app's webhooks when content changes:

- **`/api/webhooks/on-create`** — new document detected, triggers a `download-content-item` flow run
- **`/api/webhooks/on-update`** — document updated, re-triggers the download flow
- **`/api/webhooks/on-delete`** — document deleted, removes it from MongoDB
- **`/api/webhooks/on-download-complete`** — Membrane has finished downloading; the app extracts text and stores the result in S3

---

## Architecture

```
Browser (localStorage: customerId, libraryId, apiToken)
  │
  ├── x-auth-id / x-customer-name / x-credentials headers
  │
Next.js API routes
  ├── /api/integration-token   → JWT signed with workspace key + secret
  ├── IntegrationAppClient({ token, credentials: { libraryId, apiToken } })
  ├── MongoDB (sync records, document metadata)
  └── S3 (extracted text content)
        │
Membrane SDK / API
  ├── integrationApp.open()                    → embedded integration browser
  ├── integrationApp.flowInstance(id).patch()  → enable/disable flows
  ├── connection.action("list-smartly-files")  → S3 ListObjectsV2
  ├── connection.action("get-smartly-files")   → S3 GetObject
  ├── connection.action("send-files")          → S3 PutObject (via downloadUrl)
  └── POST /flows/.../run                      → trigger flow per document
        │
Membrane Files API
  └── POST /files → temporary download URL for binary transfer
```

---

## Prerequisites

- Node.js 18+
- Membrane workspace credentials (Workspace Key and Secret) — [get them here](https://console.integration.app/settings/workspace)
- MongoDB connection string
- AWS S3 credentials (for text content storage)
- Smartly account with API token enabled (`asset_library_upload_api_token` feature gate)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env-sample .env
```

Fill in `.env`:

```env
# Membrane / Integration.app
INTEGRATION_APP_WORKSPACE_KEY=
INTEGRATION_APP_WORKSPACE_SECRET=

# MongoDB
MONGODB_URI=

# AWS S3 (for storing extracted text)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-2
AWS_BUCKET_NAME=
```

Smartly credentials (`libraryId` and `apiToken`) are entered per-user on the Overview page and stored in localStorage — they are not required as environment variables.

### 3. Add the scenario to your workspace

This app relies on predefined flows and actions. Navigate to the [Continuously Import Content to My App scenario](https://integration.app/scenarios/continuously-import-content-to-my-app) and click **Add to App**.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## MongoDB via Docker

```bash
docker-compose up
```

```env
MONGODB_URI=mongodb://admin:password123@localhost:27017/knowledge
```

---

## License

MIT
