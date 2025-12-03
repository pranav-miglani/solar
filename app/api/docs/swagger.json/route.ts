import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/swagger';

export async function GET() {
  // Disable Swagger in production for security
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'API documentation is not available in production' },
      { status: 404 }
    );
  }

  return NextResponse.json(swaggerSpec);
}

