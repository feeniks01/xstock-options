/**
 * NVDA Volatility API Endpoint
 * 
 * GET: Returns cached NVDA volatility data (fetches fresh if cache expired)
 * POST: Forces a refresh of NVDA data from Yahoo Finance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNVDAVolatility, getCacheStatus, getDefaultVolatilityData } from '../../../lib/nvda-volatility';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const forceRefresh = searchParams.get('refresh') === 'true';
        
        const data = await getNVDAVolatility(forceRefresh);
        const cacheStatus = getCacheStatus();
        
        return NextResponse.json({
            success: true,
            ...data,
            cache: cacheStatus
        });
    } catch (error) {
        console.error('NVDA Volatility API error:', error);
        
        // Return default values on error
        const defaultData = getDefaultVolatilityData();
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            ...defaultData
        });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Force refresh
        const data = await getNVDAVolatility(true);
        const cacheStatus = getCacheStatus();
        
        return NextResponse.json({
            success: true,
            message: 'NVDA volatility data refreshed',
            ...data,
            cache: cacheStatus
        });
    } catch (error) {
        console.error('NVDA Volatility refresh error:', error);
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : 'Failed to refresh NVDA data'
            },
            { status: 500 }
        );
    }
}
