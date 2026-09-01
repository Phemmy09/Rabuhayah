import Retell from 'retell-sdk';
import { config } from '../config.js';

let retellClientInstance: Retell | null = null;

export function getRetellClient(): Retell {
  if (!retellClientInstance) {
    retellClientInstance = new Retell({
      apiKey: config.retell.apiKey || 'dummy-key-for-init',
    });
  }
  return retellClientInstance;
}
