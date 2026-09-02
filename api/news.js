import { json, news } from '../lib/market-data.js';

export default {
  async fetch() {
    try {
      return json(await news('경제 금융 시장'));
    } catch (error) {
      console.error(error);
      return json({ error: 'News data is temporarily unavailable.' }, 502);
    }
  }
};
