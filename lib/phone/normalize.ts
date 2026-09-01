import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { config } from '../config.js';

export interface NormalizedPhoneResult {
  raw: string;
  e164: string;
  isValid: boolean;
  country?: CountryCode | string;
  countryCallingCode?: string;
  nationalNumber?: string;
  variations: string[]; // Variations for flexible CRM search (e.g. E.164, local with 0, bare digits)
}

/**
 * Normalizes phone numbers to standard E.164 format and generates search variations
 * 
 * Supports:
 * - Nigeria (+234): 08012345678, +2348012345678, 2348012345678, 0801 234 5678
 * - UAE (+971): 0509732525, +971509732525, 971509732525, 026591000
 * - International: +14155552671, +447911123456, etc.
 */
export function normalizePhone(
  rawPhone: string | null | undefined,
  defaultCountry: string = config.business.defaultPhoneCountry || 'NG'
): NormalizedPhoneResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      raw: '',
      e164: '',
      isValid: false,
      variations: [],
    };
  }

  const raw = rawPhone.trim();
  // Strip common decorative characters
  const cleaned = raw.replace(/[^\d+]/g, '');

  if (!cleaned) {
    return {
      raw,
      e164: '',
      isValid: false,
      variations: [],
    };
  }

  // Attempt parsing via libphonenumber-js
  try {
    let parsed = parsePhoneNumberFromString(cleaned, defaultCountry.toUpperCase() as CountryCode);

    // If initial parse fails or is invalid, try auto-fixing known country prefixes if bare number was provided
    if (!parsed || !parsed.isValid()) {
      if (cleaned.startsWith('234') && cleaned.length >= 12) {
        parsed = parsePhoneNumberFromString(`+${cleaned}`, 'NG');
      } else if (cleaned.startsWith('971') && cleaned.length >= 11) {
        parsed = parsePhoneNumberFromString(`+${cleaned}`, 'AE');
      } else if (!cleaned.startsWith('+')) {
        // Try prepending +
        parsed = parsePhoneNumberFromString(`+${cleaned}`);
      }
    }

    if (parsed && parsed.isValid()) {
      const e164 = parsed.format('E.164');
      const nationalNumber = parsed.nationalNumber;
      const countryCallingCode = parsed.countryCallingCode;
      const country = parsed.country;

      // Build search variations
      const variations = new Set<string>();
      variations.add(e164); // +2348012345678
      variations.add(e164.replace('+', '')); // 2348012345678
      variations.add(nationalNumber); // 8012345678
      variations.add(`0${nationalNumber}`); // 08012345678
      if (raw !== e164) {
        variations.add(raw);
      }

      return {
        raw,
        e164,
        isValid: true,
        country,
        countryCallingCode,
        nationalNumber,
        variations: Array.from(variations),
      };
    }
  } catch {
    // Fall back to rule-based parser
  }

  // Fallback Rule-based normalization
  return fallbackNormalize(raw, defaultCountry);
}

/**
 * Fallback normalizer using deterministic regex logic
 */
function fallbackNormalize(raw: string, defaultCountry: string): NormalizedPhoneResult {
  const digitsOnly = raw.replace(/\D/g, '');
  let e164 = '';
  let nationalNumber = '';
  let callingCode = '';

  const country = defaultCountry.toUpperCase();

  if (raw.startsWith('+')) {
    e164 = `+${digitsOnly}`;
  } else if (country === 'NG') {
    if (digitsOnly.startsWith('234') && digitsOnly.length >= 12) {
      e164 = `+${digitsOnly}`;
      nationalNumber = digitsOnly.slice(3);
      callingCode = '234';
    } else if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
      e164 = `+234${digitsOnly.slice(1)}`;
      nationalNumber = digitsOnly.slice(1);
      callingCode = '234';
    } else if (digitsOnly.length === 10) {
      e164 = `+234${digitsOnly}`;
      nationalNumber = digitsOnly;
      callingCode = '234';
    } else {
      e164 = `+${digitsOnly}`;
    }
  } else if (country === 'AE') {
    if (digitsOnly.startsWith('971') && digitsOnly.length >= 11) {
      e164 = `+${digitsOnly}`;
      nationalNumber = digitsOnly.slice(3);
      callingCode = '971';
    } else if (digitsOnly.startsWith('0') && (digitsOnly.length === 10 || digitsOnly.length === 9)) {
      e164 = `+971${digitsOnly.slice(1)}`;
      nationalNumber = digitsOnly.slice(1);
      callingCode = '971';
    } else if (digitsOnly.length === 9) {
      e164 = `+971${digitsOnly}`;
      nationalNumber = digitsOnly;
      callingCode = '971';
    } else {
      e164 = `+${digitsOnly}`;
    }
  } else {
    e164 = `+${digitsOnly}`;
  }

  const variations = new Set<string>();
  if (e164) {
    variations.add(e164);
    variations.add(e164.replace('+', ''));
    if (nationalNumber) {
      variations.add(nationalNumber);
      variations.add(`0${nationalNumber}`);
    }
  }
  if (raw) {
    variations.add(raw);
  }

  const isValid = e164.length >= 8 && e164.length <= 16;

  return {
    raw,
    e164,
    isValid,
    countryCallingCode: callingCode || undefined,
    nationalNumber: nationalNumber || undefined,
    variations: Array.from(variations),
  };
}
