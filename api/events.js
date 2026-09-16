import { json, events } from '../lib/market-data.js';

export default {
  async fetch() {
    try {
      return json(await events());
    } catch (error) {
      console.error(error);
      return json({ error: 'Events data is temporarily unavailable.' }, 502);
    }
  }
};

