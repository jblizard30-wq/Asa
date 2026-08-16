import dns from 'dns';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // shared/CGNAT address space
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIPv4(normalized.slice(7));
  const firstGroup = normalized.split(':')[0];
  if (/^f[cd]/.test(firstGroup)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(firstGroup)) return true; // fe80::/10 link-local
  return false;
}

/**
 * Resolves the URL's hostname and rejects loopback/private/link-local/CGNAT targets — otherwise
 * a webhook URL is an SSRF primitive onto internal services and cloud metadata endpoints (e.g.
 * 169.254.169.254). Called both at registration (for immediate feedback) and again right before
 * each delivery (since DNS can be repointed after a webhook is created).
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Enter a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Webhook URL must use http or https');
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('Webhook URL host is not allowed');
  }

  const addresses = await dns.promises.lookup(hostname, { all: true });
  if (addresses.length === 0) {
    throw new Error('Could not resolve webhook URL host');
  }
  for (const { address, family } of addresses) {
    const isPrivate = family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
    if (isPrivate) {
      throw new Error('Webhook URL resolves to a private or internal address');
    }
  }
}
