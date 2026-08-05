import dns from 'dns';
import net from 'net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized === '::') return true;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // fe80::/10 link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7 unique local
  // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) — check the embedded IPv4.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognized — fail closed
}

/**
 * Throws if `url` is not a safe outbound target: rejects non-http(s) protocols, credentials in
 * the URL, and any hostname that is or resolves to a loopback/private/link-local address (which
 * would let a webhook be used as an SSRF vector against internal services or cloud metadata
 * endpoints). Re-resolving at dispatch time (not just at creation time) narrows, but doesn't
 * eliminate, a DNS-rebinding gap between validation and the actual outbound request.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Enter a valid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL must not contain credentials');
  }

  const hostname = parsed.hostname;
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new Error('That host is not allowed');
  }

  // URL.hostname keeps the enclosing brackets for IPv6 literals (e.g. "[::1]"); net.isIP and the
  // DNS/IP checks below all expect the bare address.
  const bareHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  if (net.isIP(bareHostname)) {
    if (isPrivateIP(bareHostname)) throw new Error('That host is not allowed');
    return;
  }

  let addresses: string[];
  try {
    addresses = (await dns.promises.lookup(hostname, { all: true })).map((a) => a.address);
  } catch {
    throw new Error('Could not resolve that host');
  }
  if (addresses.length === 0 || addresses.some((addr) => isPrivateIP(addr))) {
    throw new Error('That host is not allowed');
  }
}
