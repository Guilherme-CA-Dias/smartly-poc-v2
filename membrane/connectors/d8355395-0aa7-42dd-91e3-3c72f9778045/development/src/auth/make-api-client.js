import { RestApiClient } from '@integration-app/connector-sdk'
import crypto from 'crypto'
import { URL } from 'url'

export default async function makeAPIClient({ credentials }) {
  function getHeaders({ method, path, query, data }) {
    // Determine the base URI
    let baseUri
    let region = credentials.AWS_REGION || 'us-east-1'
    
    if (credentials.ENDPOINT_URL) {
      // Custom S3-compatible endpoint
      baseUri = credentials.ENDPOINT_URL.replace(/\/$/, '') // Remove trailing slash
    } else {
      // Default AWS S3 endpoint
      baseUri = `https://s3.${region}.amazonaws.com`
    }
    
    const url = new URL(path, baseUri)
    const pathName = url.pathname
    const host = url.host

    const amzdate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
    const datestamp = amzdate.slice(0, 8)
    
    // Convert the query object to a query string
    let queryString = ''
    if (query) {
      queryString = Object.entries(query)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join('&')
    }

    const canonicalHeaders = `host:${host}\nx-amz-date:${amzdate}\n`
    const signedHeaders = 'host;x-amz-date'

    const payloadHash = crypto
      .createHash('sha256')
      .update(data ?? '', 'utf8')
      .digest('hex')
    const canonicalRequest = `${method}\n${pathName}\n${queryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

    // String to sign
    const algorithm = 'AWS4-HMAC-SHA256'
    const credentialScope = `${datestamp}/${region}/s3/aws4_request`
    const stringToSign = `${algorithm}\n${amzdate}\n${credentialScope}\n${crypto
      .createHash('sha256')
      .update(canonicalRequest, 'utf8')
      .digest('hex')}`

    // Signing key
    const kDate = crypto
      .createHmac('sha256', `AWS4${credentials.AWS_SECRET_ACCESS_KEY}`)
      .update(datestamp, 'utf8')
      .digest()
    const kRegion = crypto
      .createHmac('sha256', kDate)
      .update(region, 'utf8')
      .digest()
    const kService = crypto
      .createHmac('sha256', kRegion)
      .update('s3', 'utf8')
      .digest()
    const kSigning = crypto
      .createHmac('sha256', kService)
      .update('aws4_request', 'utf8')
      .digest()

    // Signature
    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(stringToSign, 'utf8')
      .digest('hex')

    // Authorization header
    const authorizationHeader = `${algorithm} Credential=${credentials.AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    return {
      baseUri,
      headers: {
        'x-amz-date': amzdate,
        'x-amz-content-sha256': payloadHash,
        Authorization: authorizationHeader,
      },
    }
  }

  return new RestApiClient({
    dynamicOptions: getHeaders,
  })
}
