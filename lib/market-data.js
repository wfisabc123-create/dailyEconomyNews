const symbols = ['^KS11', '^KQ11', '^GSPC', '^IXIC', '^N225', '^HSI', 'KRW=X', 'CL=F', 'BTC-USD'];
const koreanIndices = { '^KS11': 'KOSPI', '^KQ11': 'KOSDAQ' };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' }
  });
}

async function fetchFast(url, headers, timeout = 6000) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout), cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

export async function markets() {
  const yahooSymbols = symbols.filter((symbol) => !koreanIndices[symbol]);
  const settled = await Promise.allSettled(yahooSymbols.map(async (symbol) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&_=${Date.now()}`;
    const response = await fetchFast(url, { 'User-Agent': 'Economic-Briefing-Dashboard/1.0' }, 4500);
    const source = await response.json();
    return [symbol, source.chart.result?.[0]?.meta];
  }));
  const quotes = Object.fromEntries(settled.filter((item) => item.status === 'fulfilled' && item.value[1]).map((item) => item.value));
  await Promise.all(Object.entries(koreanIndices).map(async ([symbol, indexName]) => {
    try {
      const response = await fetchFast(`https://m.stock.naver.com/api/index/${indexName}/price?pageSize=1&page=1`, { 'User-Agent': 'Mozilla/5.0' }, 3000);
      const latest = (await response.json())[0];
      const number = (value) => Number(String(value).replace(/,/g, ''));
      const price = number(latest.closePrice);
      const change = number(latest.compareToPreviousClosePrice);
      if (Number.isFinite(price) && Number.isFinite(change)) quotes[symbol] = {
        regularMarketPrice: price,
        regularMarketPreviousClose: price - change,
        regularMarketTime: Math.floor(Date.now() / 1000),
        exchangeTimezoneName: 'Asia/Seoul',
        source: 'Naver Finance',
        marketState: '장중'
      };
    } catch (error) {
      console.warn(`${indexName} intraday source unavailable: ${error.message}`);
    }
  }));
  return quotes;
}

async function translateToKorean(value) {
  if (!value || /[\uac00-\ud7a3]/.test(value)) return value;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(value)}`;
    const response = await fetchFast(url, { 'User-Agent': 'Economic-Briefing-Dashboard/1.0' }, 3000);
    const result = await response.json();
    return result?.[0]?.map((part) => part[0]).join('') || value;
  } catch {
    return value;
  }
}

export async function news(rssQuery, translate = false) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(rssQuery)}&hl=ko&gl=KR&ceid=KR:ko&_=${Date.now()}`;
  const response = await fetchFast(url, { 'User-Agent': 'Mozilla/5.0 Economic-Briefing-Dashboard/1.0' }, 6500);
  const xml = await response.text();
  const clean = (value = '') => value.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  const articles = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const item = match[1];
    const value = (tag) => clean((item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)) || [])[1] || '');
    const rawTitle = value('title');
    const parts = rawTitle.split(' - ');
    return {
      title: parts.slice(0, -1).join(' - ') || rawTitle,
      domain: parts.at(-1) || 'Google News',
      seendate: value('pubDate'),
      url: value('link'),
      summary: '최신 경제·금융·시장 보도입니다.'
    };
  }).filter((article) => article.title && article.url).slice(0, 10);
  if (!translate) return articles;
  return Promise.all(articles.map(async (article) => ({
    ...article,
    title: await translateToKorean(article.title),
    summary: await translateToKorean(article.summary)
  })));
}
