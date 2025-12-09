import { NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * 
 * Clears the bypass token cookie.
 */
export async function POST() {
  const response = NextResponse.json(
    { success: true, message: 'Logged out' },
    { status: 200 }
  );

  // Clear the bypass cookie
  response.cookies.set('bypass_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });

  return response;
}
