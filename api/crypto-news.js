import { json, news } from '../lib/market-data.js';

export default {
  async fetch() {
    try {
      return json(await news('비트코인 이더리움 가상자산', true));
    } catch (error) {
      console.error(error);
      return json({ error: 'Crypto news is temporarily unavailable.' }, 502);
    }
  }
};
