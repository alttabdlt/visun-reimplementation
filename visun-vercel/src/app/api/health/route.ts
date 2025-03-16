import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Visun API is healthy',
    timestamp: new Date().toISOString(),
  });
}
