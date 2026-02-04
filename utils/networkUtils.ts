
export const isValidIP = (ip: string): boolean => {
  const pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return pattern.test(ip.trim());
};

export const isValidHostname = (host: string): boolean => {
  const pattern = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
  return pattern.test(host.trim());
};

export const expandRange = (range: string): string[] => {
  // Regex to match x.x.x.y-z pattern
  const pattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})-(\d{1,3})$/;
  const match = range.trim().match(pattern);
  if (!match) return [];

  const prefix = match[1];
  const start = parseInt(match[2]);
  const end = parseInt(match[3]);

  if (isNaN(start) || isNaN(end) || start > 255 || end > 255) return [];

  const results: string[] = [];
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  
  // Cap range to reasonable size for browser-side monitoring
  const count = max - min + 1;
  const safeMax = Math.min(max, min + 100); 

  for (let i = min; i <= safeMax; i++) {
    results.push(`${prefix}${i}`);
  }
  
  return results;
};

export const expandSubnet = (cidr: string): string[] => {
  // Simple simulator for CIDR expansion (/24 support mostly)
  const parts = cidr.split('/');
  if (parts.length !== 2) return isValidIP(cidr) ? [cidr] : [];
  
  const baseIP = parts[0];
  const mask = parseInt(parts[1]);
  
  if (mask < 24 || mask > 32) return [baseIP]; 
  
  const ipParts = baseIP.split('.').map(Number);
  const results: string[] = [];
  const start = 1;
  const end = Math.pow(2, 32 - mask) - 2; 
  
  for (let i = start; i <= Math.min(end, 254); i++) {
    results.push(`${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${i}`);
  }
  
  return results;
};

export const parseBulkInput = (input: string): string[] => {
  // Split by whitespace, comma, or semicolon
  const rawList = input.split(/[\s,;]+/).filter(i => i.length > 0);
  const expanded: string[] = [];
  
  rawList.forEach(item => {
    const trimmed = item.trim();
    if (trimmed.includes('/')) {
      expanded.push(...expandSubnet(trimmed));
    } else if (trimmed.includes('-') && /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})-(\d{1,3})$/.test(trimmed)) {
      expanded.push(...expandRange(trimmed));
    } else if (isValidIP(trimmed) || isValidHostname(trimmed)) {
      expanded.push(trimmed);
    }
  });
  
  return Array.from(new Set(expanded)); // Return unique targets
};
