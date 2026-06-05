# FileStore Public API Documentation

This document provides technical specifications and usage guidelines for the Public
API of our asset/file management service - FileStore. This API offers compatibility with
the AWS S3 Command Line Interface CLI and Software Development Kit SDK for
seamless integration.

The API provides core functionalities for managing assets and files within a library
(bucket), including listing, retrieving, uploading, deleting, and copying assets (objects).


## Authentication and Authorization

Access to the Public API is controlled using API token authentication. All requests must
be signed with a valid API token (x-amz-security-token or x-api-token request
header).

```
Mechanism Description
```
```
API Token Required for all requests.
CLI Session Token AWS_SESSION_TOKEN
REST request header:
x-amz-security-token or x-api-token.
```
```
Authorization Access is controlled on a per-library basis.
Unauthorized access attempts (e.g., missing
or invalid session token) will result in a 403
Forbidden response.
```
## Generate session token (API key)

The session token must be generated using the Smartly app.

1. Enable Public API token feature gate ‘asset_library_upload_api_token‘ for
    your company in Smartly app. This allows users of the company to generate their
    unique API token to use with the API. (refer Fig. 1 below)
2. Once the feature gate is enabled, each user of the company can proceed to their
    respective profile to generate a token.
       a. Login to Smartly app.
       b. Click on your name/username in the bottom-left corner.
       c. From the popup, select “My Profile”.
       d. On the profile page, select the tab “API tokens”.
       e. Click button “Generate new API token”
       f. Select option “Asset Library API”.
       g. Click the button “Generate” to generate the token.
       h. Copy the token string from the next modal. WARNING: the token will never be
          visible again once the modal is closed. If lost, the generated token must be
          deleted/revoked and a new one can be generated.


Fig. 1: Feature gate 'asset_library_upload_api_token' enabled for company

Fig. 2: My profile page of user with generated API token for Asset Library API


```
Shell
```
```
TypeScript
```
## Supported Operations AWS S3 Compatibility)

The Public API is compatible with the following AWS S3 API operations:

```
Operation Description
```
```
HeadBucket Check^ if^ a^ bucket^ exists^ and^ you^ have^ permission^ to^ access^ it.^
```
```
ListObjectsV2 Retrieves^ a^ list^ of^ objects^ in^ a^ bucket.^
```
```
HeadObject Retrieves^ metadata^ about^ an^ object^ without^ returning^ the^ object^
itself.
```
```
GetObject Retrieves^ an^ object^ from^ the^ bucket.^
```
```
PutObject Adds^ an^ object^ to^ a^ bucket.^
```
```
DeleteObject Deletes^ an^ object^ from^ a^ bucket.^
```
```
CopyObject Creates^ a^ copy^ of^ an^ object^ that^ is^ already^ stored^ in^ S3.^
```
### Using the S3 CLI:

```
AWS_ACCESS_KEY_ID=unused \
AWS_SECRET_ACCESS_KEY=unused \
AWS_SESSION_TOKEN='{your-api-token}' \
aws --endpoint-url "https://app.smartly.io/filestore/public" \
s3 ls s3://{library_id}
```
### Using the NodeJS SDK

```
const client = new S3Client({
region: "us-east-1", // all/any regions are valid
endpoint: "https://app.smartly.io/filestore/public",
credentials: {
accessKeyId: "unused",
secretAccessKey: "unused",
sessionToken: "{your-api-token}",
},
forcePathStyle: true,
});
```

## HeadBucket

This operation determines if a bucket exists and you have permission to access it.

```
AWS S3 CLI Command Example Description
```
```
aws s3api head-bucket --bucket
{library-id}
```
```
Check the status of a specific bucket.
```
### Expected Status Codes

```
Status Code Description
```
```
200 Bucket is accessible.
```
```
403 Access denied (invalid authentication/authorization).
```
```
404 The specified bucket does not exist.
```
```
429 Rate limit exceeded
```

```
TypeScript
```
## ListObjectsV

This operation retrieves a list of some or all of the objects in a bucket.

```
AWS S3 CLI Command Example Description
```
```
aws s3api list-objects-v2 --bucket
{library-id}
```
```
List all objects in the bucket.
```
```
aws s3api list-objects-v2 --bucket
{library-id} --prefix "folder/"
```
```
List objects with a specific prefix.
```
```
aws s3api list-objects-v2 --bucket
{library-id} --max-keys 10
```
```
Limit the number of objects
returned.
```
```
const result = await client.send(
new ListObjectsV2Command({
Bucket: "{library-id}",
Prefix: prefix,
Delimiter: "/",
MaxKeys: 500 ,
}),
);
```
### Pagination

The API supports standard S3 pagination using MaxKeys, ContinuationToken, and
StartAfter.

```
Parameter Description
```
```
MaxKeys Sets the maximum number of keys returned in
the response. Default is 1000.
```
```
ContinuationToken Token^ to^ continue^ a^ previous^ list^ request.^
```
```
StartAfter Specifies the key to start with when listing
objects.
```

### Expected Status Codes

```
Status Code Description
```
```
200 Successful listing of objects.
```
```
403 Access denied.
```
```
404 The specified bucket does not exist.
```
```
429 Rate limit exceeded
```

```
TypeScript
```
## HeadObject

This operation retrieves metadata about an object without returning the object itself.

```
AWS S3 CLI Command Example Description
```
```
aws s3api head-object --bucket
{library-id} --key "asset-name.jpg"
```
```
Get metadata for a specific object.
```
```
const result = await client.send(
new HeadObjectCommand({
Bucket: "{library-id}",
Key: "{asset-path}"
}),
);
```
### Expected Status Codes

```
Status Code Description
```
```
200 Successful retrieval of object metadata. Response headers
include ETag, LastModified, and custom metadata.
```
```
403 Access denied.
```
```
404 Object not found.
```
```
429 Rate limit exceeded
```

```
TypeScript
```
## GetObject

This operation retrieves an object from the bucket.

```
AWS S3 CLI Command Example Description
```
```
aws s3api get-object --bucket
{library-id} --key "asset-name.mp4"
```
```
Download a file from the bucket.
```
```
const result = await client.send(
new GetObjectCommand({
Bucket: "{library-id}",
Key: "{asset-path}"
}),
);
```
### Expected Status Codes

```
Status Code Description
```
```
200 Successful retrieval of the object.
```
```
403 Access denied.
```
```
404 Object not found.
```
```
429 Rate limit exceeded
```

```
TypeScript
```
## PutObject

This operation adds an object to a bucket.

```
AWS S3 CLI Command Example Description
```
```
aws s3api put-object --bucket
{library-id} --key "new-asset.png"
--body ./new-asset.png
```
```
Upload a new object.
```
```
aws s3api put-object --bucket
{library-id} --key
"folder/nested.png" --body
./new-asset.png --content-type
"image/png"
```
```
Upload an object to a nested
path, explicitly specifying MIME
type.
```
```
const result = await client.send(
new PutObjectCommand({
Bucket: "{library-id}",
Key: "{asset-path}",
Body: file.buffer,
ContentType: file.mimetype || "application/octet-stream",
}),
);
```
### Variation upload

A variation of an asset can be uploaded for the same path/key.

```
AWS S3 CLI Command Example Description
```
```
aws s3api put-object \
--bucket {library-id} \
--key "variation.jpg" \
--body "./asset.jpg" \
--metadata
'{"parent-asset-path":"path/to/the/p
arent/in/smartly/asset.jpg","crop-me
tadata":"{\"x\":35,\"y\":53,\"width\
```
```
Upload variation.jpg as a variation
of previously uploaded asset.jpg.
The parent path should be
provided with variation rules like
crop-metadata.
```

```
AWS S3 CLI Command Example Description
```
```
":40,\"height\":20,\"rotation\":123}
"}'
```
```
aws s3api put-object \
--bucket {library-id} \
--key "video-variation.mp4" \
--body "./video.mp4" \
--content-type "video/mp4" \
--metadata
'{"parent-asset-id":"parent-asset-pa
th":"path/to/the/parent/in/smartly/v
ideo.mp4","thumbnail-time":"12"}'
```
```
Upload video-variation.mp4 as a
variation of previously uploaded
video.jpg.
The parent path should be
provided with variation rules like
thumbnail-time.
```
### Expected Status Codes

```
Status Code Description
```
(^200) Successful upload. Response includes ETag.
400 Invalid request or incomplete body
403 Access denied.
409 Conflict with existing object
413 File is too large to upload 2GB
429 Rate limit exceeded


```
TypeScript
```
## DeleteObject

This operation removes an object from a bucket.

```
AWS S3 CLI Command Example Description
```
```
aws s3api delete-object --bucket
{library-id} --key "old-asset.jpg"
```
```
Delete a specific object.
```
```
const result = await client.send(
new DeleteObjectCommand({
Bucket: "{library-id}",
Key: "{asset-path}",
}),
);
```
### Expected Status Codes

```
Status Code Description
```
```
204 Successful deletion (or the object did not exist,
providing idempotency).
```
```
403 Access denied.
```
```
405 Method not allowed (e.g., attempting to delete a
producer or template project).
```
```
412 Precondition failed (e.g., ETag does not match for an
If-Match condition).
```
```
429 Rate limit exceeded
```

```
TypeScript
```
## CopyObject

This operation creates a copy of an object that is already stored in a bucket.

```
AWS S3 CLI Command Example Description
```
```
aws s3api copy-object --bucket
{library-id} --key "new-copy.jpg"
--copy-source
“{source-library-id}/original.jpg"
```
```
Copy an asset from the root to a
new key.
```
```
aws s3api copy-object --bucket
{library-id} --key "same-asset.jpg"
--copy-source
"{source-library-id}/same-asset.jpg"
--metadata '{"color":"blue"}'
```
```
Update metadata on an existing
asset.
```
```
const result = await client.send(
new CopyObjectCommand({
Bucket: "{library-id}",
Key: "{dest-asset-path}",
CopySource: `${source-library-id}/${encodeURIComponent(sourcePath)}`,
}),
);
```
### Expected Status Codes

```
Status Code Description
```
```
200 Successful copy. Response includes XML body with
LastModified and ETag.
```
```
400 Invalid request for cross-bucket copy or self-copy
without REPLACE or invalid arguments
```
```
404 Missing source
```
```
403 Access denied.
```

Status Code Description

405 Method not allowed for producers and templates

409 Conflict if the destination already exists.

429 Rate limit exceeded


## Troubleshooting and Notes

```
Issue Description Expected Fix/Behavior
```
```
Rate limit (error
429
```
```
The Public API allows a certain
number of requests per hour per
library. If the library has received
more requests per hour than
allowed, the API will return an error
429, blocking further requests until
the time resets.
```
```
The usage has
exceeded the quota and
the user must wait until
the limit resets. Users
can check response
headers for keys like
Retry-After or
x-ratelimit-remaini
ng and
x-ratelimit-reset to
see when the limit
resets.
```
