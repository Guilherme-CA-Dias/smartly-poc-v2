import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/server-auth";
import { generateCustomerAccessToken } from "@/lib/integration-token";

const INTEGRATION_APP_API = "https://api.integration.app";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const connectionId = (await params).integrationId;
    const integrationKey = request.nextUrl.searchParams.get("integrationKey");

    const auth = getAuthFromRequest(request);
    const token = await generateCustomerAccessToken(auth);

    const query = new URLSearchParams({ layer: "connection" });
    if (integrationKey) query.set("integrationKey", integrationKey);

    const response = await fetch(
      `${INTEGRATION_APP_API}/flow-instances?${query}&connectionId=${connectionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch flow instances:", error);
    return NextResponse.json(
      { error: "Failed to fetch flow instances" },
      { status: 500 }
    );
  }
}
