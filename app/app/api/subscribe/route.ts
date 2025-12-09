import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase';

/**
 * POST /api/subscribe
 * 
 * Handles email subscription requests.
 * Validates email and stores it in Supabase 'subscribers' table.
 * 
 * Expected table schema:
 * - id: uuid (primary key, auto-generated)
 * - email: text (unique, not null)
 * - createdAt: timestamp (default: now())
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Client-side validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = getSupabaseServerClient();
    
    if (!supabase) {
      // Supabase not configured - return error
      return NextResponse.json(
        { error: 'Subscription service is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.' },
        { status: 503 }
      );
    }

    // Insert email into subscribers table
    const { data, error } = await supabase
      .from('subscribers')
      .insert([
        { 
          email: email.trim().toLowerCase() 
        }
      ])
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate email error
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json(
          { error: 'This email is already subscribed' },
          { status: 409 }
        );
      }

      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to subscribe. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Successfully subscribed!',
        data 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Subscription API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
