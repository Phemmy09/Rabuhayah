import Retell from 'retell-sdk';
import { config } from '../config.js';
import { logger } from '../logging/logger.js';
import { timingSafeEqualString, computeHmacSha256 } from '../security/signatures.js';

/**
 * Verify inbound or post-call webhook signature from Retell AI
 *
 * @param rawBody - The raw stringified JSON body of the request
 * @param signature - Value of the 'x-retell-signature' header
 * @param apiKey - Retell API key / webhook secret (defaults to config)
 */
export function verifyRetellWebhook(
  rawBody: string,
  signature: string | string[] | undefined,
  apiKey: string = config.retell.apiKey
): boolean {
  // If in test environment or development without strict signature, log warning
  if (config.env === 'test' && !signature) {
    return true;
  }

  const sigString = Array.isArray(signature) ? signature[0] : signature;

  if (!sigString) {
    if (config.env === 'development') {
      logger.warn('Retell webhook received without signature (allowed only in development)');
      return true;
    }
    logger.error('Missing Retell signature header');
    return false;
  }

  if (!apiKey) {
    logger.error('RETELL_API_KEY is not configured on server');
    return false;
  }

  // 1. Attempt verification via official Retell SDK
  try {
    const isValid = Retell.verify(rawBody, apiKey, sigString);
    if (isValid) {
      return true;
    }
  } catch (sdkError) {
    logger.debug('Retell SDK verify attempt threw error, attempting HMAC fallback', undefined, sdkError);
  }

  // 2. Fallback: Native HMAC-SHA256 comparison
  try {
    const computedSig = computeHmacSha256(rawBody, apiKey);
    if (timingSafeEqualString(computedSig, sigString)) {
      return true;
    }

    // Check if secret key in config.retell.webhookSecret is different
    if (config.retell.webhookSecret && config.retell.webhookSecret !== apiKey) {
      const computedSecretSig = computeHmacSha256(rawBody, config.retell.webhookSecret);
      if (timingSafeEqualString(computedSecretSig, sigString)) {
        return true;
      }
    }
  } catch (hmacError) {
    logger.error('HMAC signature verification failed', undefined, hmacError);
  }

  return false;
}
