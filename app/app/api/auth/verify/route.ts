import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/verify
 * 
 * Verifies an access code for waitlist bypass.
 * Access codes are stored in BYPASS_ACCESS_CODES env variable (comma-separated).
 * 
 * On success, sets a secure HTTP-only cookie to persist the session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessCode } = body;

    if (!accessCode || typeof accessCode !== 'string') {
      return NextResponse.json(
        { error: 'Access code is required' },
        { status: 400 }
      );
    }

    // Get valid access codes from environment variable
    // Format: comma-separated list, e.g., "code1,code2,code3"
    const validCodes = process.env.BYPASS_ACCESS_CODES?.split(',').map(c => c.trim()) || [];

    if (validCodes.length === 0) {
      return NextResponse.json(
        { error: 'Access system not configured' },
        { status: 503 }
      );
    }

    // Verify the access code
    const isValid = validCodes.includes(accessCode.trim());

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      );
    }

    // Create response with success
    const response = NextResponse.json(
      { success: true, message: 'Access granted' },
      { status: 200 }
    );

    // Set HTTP-only cookie for session persistence
    // Cookie expires in 30 days
    response.cookies.set('bypass_token', generateBypassToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Generates a simple bypass token.
 * In production, you might want to use a more secure token generation method.
 */
function generateBypassToken(): string {
  const secret = process.env.BYPASS_TOKEN_SECRET || 'default-secret-change-me';
  const timestamp = Date.now();
  // Simple token: base64 encoded timestamp + secret hash
  const tokenData = `${timestamp}:${secret}`;
  return Buffer.from(tokenData).toString('base64');
}

/**
 * Validates a bypass token from cookie.
 * Exported for use in middleware or other routes.
 */
export function validateBypassToken(token: string | undefined): boolean {
  if (!token) return false;
  
  try {
    const secret = process.env.BYPASS_TOKEN_SECRET || 'default-secret-change-me';
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [timestamp, tokenSecret] = decoded.split(':');
    
    // Check if secret matches
    if (tokenSecret !== secret) return false;
    
    // Check if token is not expired (30 days)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    const maxAge = 60 * 60 * 24 * 30 * 1000; // 30 days in ms
    
    return tokenAge < maxAge;
  } catch {
    return false;
  }
}
