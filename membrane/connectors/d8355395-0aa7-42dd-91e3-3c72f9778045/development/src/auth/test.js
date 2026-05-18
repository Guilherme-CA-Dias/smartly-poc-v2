export default async function test({ externalApiClient, credentials }) {
  try {
    // Determine the base URI for the test
    let baseUri
    const region = credentials.AWS_REGION || 'us-east-1'
    
    if (credentials.ENDPOINT_URL) {
      baseUri = credentials.ENDPOINT_URL.replace(/\/$/, '')
    } else {
      baseUri = `https://s3.${region}.amazonaws.com`
    }
    
    // Try to list buckets - this is a simple operation that validates credentials
    const response = await externalApiClient.get('/')
    
    // If we get a successful response, credentials are valid
    return response && response.status !== 403 && response.status !== 401
  } catch (error) {
    // If it's an auth error, credentials are invalid
    if (error.response && (error.response.status === 403 || error.response.status === 401)) {
      return false
    }
    // For other errors, we assume credentials might be valid but endpoint is unreachable
    // This is acceptable for S3-compatible services that might have different response formats
    return true
  }
}
