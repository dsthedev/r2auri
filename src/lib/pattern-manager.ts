import {
  SmartPatternMetadata,
  DEFAULT_SMART_PATTERNS,
} from "@/types/smart-patterns";

/**
 * Merges default patterns with custom patterns from settings.
 * Default patterns always come first, followed by custom patterns.
 * This ensures consistent ordering and prevents duplicates.
 */
export function mergePatterns(
  customPatterns: SmartPatternMetadata[] | undefined
): SmartPatternMetadata[] {
  // Include all default patterns with their isDefault flag set
  const defaults = DEFAULT_SMART_PATTERNS.map((p) => ({
    ...p,
    isDefault: true,
  }));

  if (!customPatterns || customPatterns.length === 0) {
    return defaults;
  }

  // Filter out any custom patterns that might have the default flag
  // (shouldn't happen, but be safe)
  const custom = customPatterns.filter((p) => !p.isDefault);

  return [...defaults, ...custom];
}

/**
 * Gets a single pattern by ID from the merged list.
 * Returns undefined if pattern not found.
 */
export function getPatternById(
  allPatterns: SmartPatternMetadata[],
  id: string
): SmartPatternMetadata | undefined {
  return allPatterns.find((p) => p.id === id);
}

/**
 * Gets enabled patterns that should be active for analysis.
 */
export function getEnabledPatterns(
  allPatterns: SmartPatternMetadata[]
): SmartPatternMetadata[] {
  return allPatterns.filter((p) => p.enabled);
}
