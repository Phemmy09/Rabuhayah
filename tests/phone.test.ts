import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../lib/phone/normalize.js';

describe('Phone Normalization Engine', () => {
  describe('Nigerian Numbers (Default: NG)', () => {
    it('normalizes local 11-digit number starting with 0', () => {
      const result = normalizePhone('08012345678', 'NG');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+2348012345678');
      expect(result.variations).toContain('+2348012345678');
      expect(result.variations).toContain('08012345678');
    });

    it('normalizes already formatted E.164 number', () => {
      const result = normalizePhone('+2348012345678', 'NG');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+2348012345678');
    });

    it('normalizes country prefix without plus', () => {
      const result = normalizePhone('2348012345678', 'NG');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+2348012345678');
    });

    it('normalizes numbers with spaces and formatting', () => {
      const result1 = normalizePhone('0801 234 5678', 'NG');
      expect(result1.isValid).toBe(true);
      expect(result1.e164).toBe('+2348012345678');

      const result2 = normalizePhone('+234 801 234 5678', 'NG');
      expect(result2.isValid).toBe(true);
      expect(result2.e164).toBe('+2348012345678');
    });

    it('handles various Nigerian mobile prefixes (070, 081, 090, 091)', () => {
      expect(normalizePhone('07031234567', 'NG').e164).toBe('+2347031234567');
      expect(normalizePhone('08121234567', 'NG').e164).toBe('+2348121234567');
      expect(normalizePhone('09091234567', 'NG').e164).toBe('+2349091234567');
      expect(normalizePhone('09121234567', 'NG').e164).toBe('+2349121234567');
    });
  });

  describe('UAE Numbers (AE)', () => {
    it('normalizes UAE mobile numbers starting with 050', () => {
      const result = normalizePhone('0509732525', 'AE');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+971509732525');
    });

    it('normalizes UAE landline numbers starting with 02', () => {
      const result = normalizePhone('026591000', 'AE');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+97126591000');
    });

    it('normalizes UAE number with country code without plus', () => {
      const result = normalizePhone('971509732525', 'AE');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+971509732525');
    });
  });

  describe('International Numbers', () => {
    it('preserves valid US E.164 numbers', () => {
      const result = normalizePhone('+14155552671');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+14155552671');
    });

    it('preserves valid UK E.164 numbers', () => {
      const result = normalizePhone('+447911123456');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+447911123456');
    });
  });

  describe('Edge Cases and Invalid Inputs', () => {
    it('handles null, undefined and empty strings gracefully', () => {
      expect(normalizePhone(null).isValid).toBe(false);
      expect(normalizePhone(undefined).isValid).toBe(false);
      expect(normalizePhone('').isValid).toBe(false);
      expect(normalizePhone('   ').isValid).toBe(false);
    });

    it('handles alphanumeric garbage gracefully', () => {
      const result = normalizePhone('abc-invalid-phone');
      expect(result.isValid).toBe(false);
    });
  });
});
