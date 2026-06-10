export function normalizeNorthAmericanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  throw new Error('Please enter a valid 10-digit phone number.');
}

export function formatNorthAmericanPhone(value) {
  const normalized = normalizeNorthAmericanPhone(value);
  const digits = normalized.slice(2);

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
