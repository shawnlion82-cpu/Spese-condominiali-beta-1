
export const generateId = (): string => {
  // Check if crypto.randomUUID is available (modern browsers, secure context)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers or non-secure contexts (http)
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
