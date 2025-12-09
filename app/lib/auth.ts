/**
 * Authentication utilities for bypass token validation
 */

/**
 * Validates a bypass token.
 * Returns true if the token is valid and not expired.
 */
export function validateBypassToken(token: string | undefined): boolean {
  if (!token) return false;
  
  try {
    const secret = process.env.BYPASS_TOKEN_SECRET || 'default-secret-change-me';
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    
    if (parts.length < 2) return false;
    
    const timestamp = parts[0];
    const tokenSecret = parts.slice(1).join(':'); // Handle secrets with colons
    
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
