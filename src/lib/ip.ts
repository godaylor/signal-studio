import ipaddr from 'ipaddr.js';

function normalizeIp(ip?: string | null) {
  if (!ip) return ip;

  try {
    const parsed = ipaddr.parse(ip);

    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      return (parsed as ipaddr.IPv6).toIPv4Address().toString();
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

function resolveIp(ip?: string | null) {
  if (!ip) return ip;

  // First, try as-is
  const normalized = normalizeIp(ip);
  try {
    ipaddr.parse(normalized);
    return normalized;
  } catch {
    // try stripping port (handles IPv4:port; leaves IPv6 intact)
    const stripped = stripPort(ip);
    if (stripped !== ip) {
      const normalizedStripped = normalizeIp(stripped);
      try {
        ipaddr.parse(normalizedStripped);
        return normalizedStripped;
      } catch {
        return undefined;
      }
    }

    return normalized;
  }
}

function parseHeaderValue(header: string, value: string) {
  if (header === 'x-forwarded-for') {
    return resolveIp(value?.split(',')?.[0]?.trim());
  }

  if (header === 'forwarded') {
    const match = value.match(/for=(\[?[0-9a-fA-F:.]+]?)/);

    return match ? resolveIp(match[1]) : undefined;
  }

  return resolveIp(value);
}

export function getIpAddress(headers: Headers) {
  const customHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();

  // Request proxy headers are caller-controlled in direct deployments. Only a
  // header explicitly configured for a trusted, overwriting proxy is accepted.
  if (!customHeader) {
    return undefined;
  }

  const value = headers.get(customHeader);
  if (!value) {
    return undefined;
  }

  return parseHeaderValue(customHeader, value);
}

export function stripPort(ip?: string | null) {
  if (!ip) {
    return ip;
  }

  if (ip.startsWith('[')) {
    const endBracket = ip.indexOf(']');
    if (endBracket !== -1) {
      return ip.slice(1, endBracket);
    }
  }

  const idx = ip.lastIndexOf(':');
  if (idx !== -1) {
    if (ip.includes('.') || /^[a-zA-Z0-9.-]+$/.test(ip.slice(0, idx))) {
      return ip.slice(0, idx);
    }
  }

  return ip;
}
