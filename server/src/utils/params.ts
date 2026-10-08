/**
 * Safely extracts a single string parameter from Express 5 req.params.
 */
export function getRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] || '';
  }
  return param || '';
}
