import { json, news } from '../lib/market-data.js';

export default {
  async fetch() {
    try {
      return json(await news('(비트코인 OR 가상자산 OR 암호화폐)', false));
    } catch (error) {
      console.error(error);
      return json({ error: 'Crypto news is temporarily unavailable.' }, 502);
    }
  }
};
