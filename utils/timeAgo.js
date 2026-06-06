/**
 * Shared relative-time formatting.
 * Used by SessionManager and DeployMonitor.
 */

export function timeAgo(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}
