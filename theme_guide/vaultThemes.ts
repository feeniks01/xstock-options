import vaultThemes from "./vaultThemes.generated.json";

export interface VaultTheme {
    accent: string;
    accentSoft: string;
    accentGlow: string;
    accentBorder: string;
}

export type VaultThemes = Record<string, VaultTheme>;

export const themes: VaultThemes = vaultThemes as VaultThemes;

/**
 * Get theme for a specific vault ticker
 * @param ticker - Vault ticker (e.g., "NVDAx", "TSLAx")
 * @returns VaultTheme object with accent colors
 */
export function getVaultTheme(ticker: string): VaultTheme {
    // Try exact match first, then uppercase, then default
    if (themes[ticker]) {
        return themes[ticker];
    }
    const normalizedTicker = ticker.toUpperCase();
    if (themes[normalizedTicker]) {
        return themes[normalizedTicker];
    }
    return themes.default;
}

/**
 * Convert theme to CSS variables object for inline styles
 * @param theme - VaultTheme object
 * @returns CSS variables object for React inline styles
 */
export function getThemeCSSVars(theme: VaultTheme): Record<string, string> {
    return {
        ["--accent" as any]: theme.accent,
        ["--accent-soft" as any]: theme.accentSoft,
        ["--accent-glow" as any]: theme.accentGlow,
        ["--accent-border" as any]: theme.accentBorder,
    };
}

/**
 * Create a themed background style with gradient
 * @param theme - VaultTheme object
 * @param baseColor - Base background color (default: #0B0F17)
 * @returns Style object with gradient background
 */
export function getThemedBackground(
    theme: VaultTheme,
    baseColor: string = "#0B0F17"
): React.CSSProperties {
    return {
        ...getThemeCSSVars(theme),
        background: `linear-gradient(135deg, ${baseColor} 0%, ${theme.accentSoft} 50%, ${baseColor} 100%)`,
        backgroundSize: '200% 200%',
    };
}

/**
 * Darken a color for hover effects
 * @param color - Hex color string (e.g., "#76B900")
 * @param amount - Amount to darken (default: 20)
 * @returns Darkened RGB color string
 */
export function darkenColor(color: string, amount: number = 20): string {
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length !== 3) return color;
    
    const r = Math.max(0, parseInt(rgb[0]) - amount);
    const g = Math.max(0, parseInt(rgb[1]) - amount);
    const b = Math.max(0, parseInt(rgb[2]) - amount);
    
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get all available vault tickers
 * @returns Array of ticker strings (excluding 'default')
 */
export function getAllVaultTickers(): string[] {
    return Object.keys(themes).filter(t => t !== 'default').sort();
}

