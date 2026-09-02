import { json, markets } from '../lib/market-data.js';

export default {
  async fetch() {
    try {
      return json(await markets());
    } catch (error) {
      console.error(error);
      return json({ error: 'Market data is temporarily unavailable.' }, 502);
    }
  }
};
