import { NextResponse } from "next/server"

/**
 * Health check endpoint for load balancer and monitoring
 * This endpoint is publicly accessible and does not require authentication
 */
export async function GET() {
  try {
    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "woms",
        version: process.env.npm_package_version || "1.0.0",
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

