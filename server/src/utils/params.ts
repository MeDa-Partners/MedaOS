/**
 * Safely extracts a single string parameter from Express 5 req.params.
 */
export function getRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] || '';
  }
  return param || '';
}

/**
 * Safely sanitizes a UUID query parameter.
 * Returns undefined if nullish, empty, or literal string "undefined", "null", or "all".
 */
export function cleanUuidParam(param: unknown): string | undefined {
  if (typeof param !== 'string') return undefined;
  const trimmed = param.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'all') {
    return undefined;
  }
  return trimmed;
}
