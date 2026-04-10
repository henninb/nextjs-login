export function logRouteError(route: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${route}]`, message);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}
