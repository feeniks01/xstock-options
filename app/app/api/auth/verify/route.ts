import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase';

/**
 * POST /api/auth/verify
 * 
 * Verifies an access code for waitlist bypass.
 * Access codes are stored in Supabase 'access_codes' table.
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

    const code = accessCode.trim();

    // Get Supabase client
    const supabase = getSupabaseServerClient();
    
    if (!supabase) {
      // Fallback to env variable if Supabase not configured
      return verifyWithEnvVar(code);
    }

    // Query the access_codes table
    const { data: accessCodeData, error: fetchError } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (fetchError || !accessCodeData) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      );
    }

    // Check if code is active
    if (!accessCodeData.is_active) {
      return NextResponse.json(
        { error: 'This access code has been deactivated' },
        { status: 401 }
      );
    }

    // Check if code has expired
    if (accessCodeData.expires_at && new Date(accessCodeData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This access code has expired' },
        { status: 401 }
      );
    }

    // Check if code has reached max uses
    if (accessCodeData.max_uses !== null && accessCodeData.used_count >= accessCodeData.max_uses) {
      return NextResponse.json(
        { error: 'This access code has reached its maximum uses' },
        { status: 401 }
      );
    }

    // Update usage tracking
    const { error: updateError } = await supabase
      .from('access_codes')
      .update({
        used_at: accessCodeData.used_at || new Date().toISOString(), // Only set first use
        used_count: (accessCodeData.used_count || 0) + 1,
      })
      .eq('id', accessCodeData.id);

    if (updateError) {
      console.error('Failed to update access code usage:', updateError);
      // Continue anyway - don't block access due to tracking failure
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
 * Fallback: Verify using environment variable if Supabase is not configured
 */
function verifyWithEnvVar(code: string): NextResponse {
  const validCodes = process.env.BYPASS_ACCESS_CODES?.split(',').map(c => c.trim()) || [];

  if (validCodes.length === 0) {
    return NextResponse.json(
      { error: 'Access system not configured' },
      { status: 503 }
    );
  }

  const isValid = validCodes.includes(code);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid access code' },
      { status: 401 }
    );
  }

  const response = NextResponse.json(
    { success: true, message: 'Access granted' },
    { status: 200 }
  );

  response.cookies.set('bypass_token', generateBypassToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return response;
}

/**
 * Generates a bypass token for cookie storage.
 */
function generateBypassToken(): string {
  const secret = process.env.BYPASS_TOKEN_SECRET || 'default-secret-change-me';
  const timestamp = Date.now();
  const tokenData = `${timestamp}:${secret}`;
  return Buffer.from(tokenData).toString('base64');
}
