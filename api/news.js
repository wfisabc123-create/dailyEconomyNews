import { json, news } from '../lib/market-data.js';

export default {
  async fetch() {
    try {
      return json(await news('(경제 OR 증시 OR 금융)'));
    } catch (error) {
      console.error(error);
      return json({ error: 'News data is temporarily unavailable.' }, 502);
    }
  }
};
