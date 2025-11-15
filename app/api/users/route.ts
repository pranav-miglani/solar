import { NextRequest, NextResponse } from "next/server"

// This route is deprecated - use /api/accounts instead
// The system uses 'accounts' table, not 'users' table
export async function GET(request: NextRequest) {
  // Redirect to accounts API
  return NextResponse.json(
    { 
      error: "This endpoint is deprecated. Use /api/accounts instead.",
      message: "The system uses 'accounts' table, not 'users' table."
    },
    { status: 410 } // 410 Gone
  )
}

