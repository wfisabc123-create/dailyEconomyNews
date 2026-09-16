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

const EVENT_TRANSLATIONS = {
  'Federal Funds Rate': '미국 기준금리 결정 (FOMC)',
  'FOMC Economic Projections': 'FOMC 경제전망 및 점도표',
  'FOMC Statement': 'FOMC 통화정책 성명서',
  'FOMC Press Conference': 'FOMC 기자회견',
  'Core Retail Sales m/m': '근원 소매판매 (전월대비)',
  'Retail Sales m/m': '소매판매 (전월대비)',
  'CPI y/y': '소비자물가지수 (전년대비)',
  'CPI m/m': '소비자물가지수 (전월대비)',
  'Core CPI m/m': '근원 소비자물가지수 (전월대비)',
  'Core CPI y/y': '근원 소비자물가지수 (전년대비)',
  'Median CPI y/y': '중간값 소비자물가지수',
  'Trimmed CPI y/y': '절사평균 소비자물가지수',
  'Common CPI y/y': '공통 소비자물가지수',
  'Non-Farm Employment Change': '비농업 고용지수 (NFP)',
  'Unemployment Rate': '실업률',
  'Unemployment Claims': '신규 실업수당 청구건수',
  'Claimant Count Change': '실업수당 청구건수 변화',
  'Average Earnings Index 3m/y': '평균 임금 지수',
  'Advance GDP q/q': 'GDP 성장률 속보치',
  'Final GDP q/q': 'GDP 성장률 확정치',
  'Prelim GDP q/q': 'GDP 성장률 잠정치',
  'ECB Interest Rate': '유럽중앙은행(ECB) 기준금리 결정',
  'ECB President Lagarde Speaks': '라가르드 ECB 총재 연설',
  'BOJ Policy Rate': '일본은행(BOJ) 정책금리 결정',
  'BOJ Press Conference': '일본은행 총재 기자회견',
  'Treasury Sec Bessent Speaks': '베센트 미국 재무장관 연설',
  'Fed Chair Powell Speaks': '제롬 파월 연준 의장 연설',
  'Crude Oil Inventories': '미국 원유 재고',
  'ISM Manufacturing PMI': 'ISM 제조업 구매관리자지수',
  'ISM Services PMI': 'ISM 서비스업 구매관리자지수',
  'Core PCE Price Index m/m': '근원 개인소비지출(PCE) 물가지수'
};

const COUNTRY_MAP = {
  USD: '미국', EUR: '유로존', GBP: '영국', JPY: '일본', CNY: '중국', CAD: '캐나다', AUD: '호주', KRW: '한국', NZD: '뉴질랜드', CHF: '스위스'
};

function getEventSource(rawTitle = '', countryCode = '') {
  const lower = rawTitle.toLowerCase();

  if (countryCode === 'KRW' || countryCode === '한국') {
    if (lower.includes('금통위') || lower.includes('한국은행') || lower.includes('기준금리')) {
      return { sourceName: '한국은행 (BOK)', sourceUrl: 'https://www.bok.or.kr/portal/bbs/B0000216/list.do?menuNo=200788' };
    }
    if (lower.includes('경제관계장관') || lower.includes('기획재정부')) {
      return { sourceName: '기획재정부', sourceUrl: 'https://www.moef.go.kr' };
    }
    return { sourceName: '통계청', sourceUrl: 'https://kostat.go.kr' };
  }

  if (lower.includes('fomc') || lower.includes('federal funds') || lower.includes('fed chair') || lower.includes('powell') || lower.includes('beige book')) {
    return { sourceName: '연방준비제도 (Fed)', sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' };
  }

  if (countryCode === 'USD' && (lower.includes('cpi') || lower.includes('ppi') || lower.includes('employment') || lower.includes('unemployment rate') || lower.includes('payroll'))) {
    return { sourceName: '미국 노동통계국 (BLS)', sourceUrl: 'https://www.bls.gov/schedule/news_release/' };
  }

  if (countryCode === 'USD' && (lower.includes('retail sales') || lower.includes('gdp') || lower.includes('trade balance'))) {
    return { sourceName: '미국 상무부 센서스국', sourceUrl: 'https://www.census.gov/economic-indicators/calendar-listview.html' };
  }

  if (countryCode === 'USD' && lower.includes('unemployment claims')) {
    return { sourceName: '미국 노동부 (DOL)', sourceUrl: 'https://www.dol.gov/ui/data.pdf' };
  }

  if (countryCode === 'USD' && (lower.includes('treasury') || lower.includes('bessent') || lower.includes('yellen'))) {
    return { sourceName: '미국 재무부', sourceUrl: 'https://home.treasury.gov/news/press-releases' };
  }

  if (countryCode === 'USD' && (lower.includes('oil') || lower.includes('crude') || lower.includes('petroleum'))) {
    return { sourceName: '미국 에너지정보청 (EIA)', sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/' };
  }

  if (countryCode === 'USD' && lower.includes('ism')) {
    return { sourceName: '공급관리협회 (ISM)', sourceUrl: 'https://www.ismworld.org/' };
  }

  if (countryCode === 'EUR' || lower.includes('ecb') || lower.includes('lagarde')) {
    return { sourceName: '유럽중앙은행 (ECB)', sourceUrl: 'https://www.ecb.europa.eu/press/calendars/mgc/html/index.en.html' };
  }

  if (countryCode === 'GBP') {
    if (lower.includes('bank of england') || lower.includes('boe') || lower.includes('monetary policy')) {
      return { sourceName: '영국 중앙은행 (BoE)', sourceUrl: 'https://www.bankofengland.co.uk/monetary-policy' };
    }
    return { sourceName: '영국 통계청 (ONS)', sourceUrl: 'https://www.ons.gov.uk/releasecalendar' };
  }

  if (countryCode === 'JPY' || lower.includes('boj')) {
    return { sourceName: '일본은행 (BOJ)', sourceUrl: 'https://www.boj.or.jp/en/mopo/index.htm' };
  }

  if (countryCode === 'CAD') {
    if (lower.includes('boc') || lower.includes('bank of canada')) {
      return { sourceName: '캐나다 중앙은행 (BoC)', sourceUrl: 'https://www.bankofcanada.ca' };
    }
    return { sourceName: '캐나다 통계청 (StatCan)', sourceUrl: 'https://www.statcan.gc.ca' };
  }

  if (countryCode === 'AUD') {
    return { sourceName: '호주 중앙은행 (RBA)', sourceUrl: 'https://www.rba.gov.au' };
  }

  const countryLabels = { USD: '미국 발표처', EUR: '유로존 통계국', GBP: '영국 발표처', JPY: '일본 통계국', CAD: '캐나다 발표처', AUD: '호주 통계국' };
  return {
    sourceName: countryLabels[countryCode] || `${countryCode} 공식처`,
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(`${countryCode} ${rawTitle} official release calendar`)}`
  };
}

function getDynamicFallbackEvents() {
  const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstNow.getFullYear();
  const month = kstNow.getMonth();
  const date = kstNow.getDate();

  const standardEvents = [
    { dayOffset: 0, time: '08:30', country: '한국', raw: '경제관계장관회의', title: '경제관계장관회의 / 물가 민생 점검', impact: 'Medium', desc: '물가·민생 관련 부처 일정' },
    { dayOffset: 0, time: '21:30', country: '미국', raw: 'Retail Sales m/m', title: '미국 주요 경제지표 발표', impact: 'High', desc: '고용·물가·소비 지표 발표' },
    { dayOffset: 1, time: '10:00', country: '한국', raw: '한국은행 금통위', title: '한국은행 금융통화위원회 및 금융시장 동향', impact: 'High', desc: '통화정책 방향 및 시장 유동성 점검' },
    { dayOffset: 1, time: '21:30', country: '미국', raw: 'Unemployment Claims', title: '미국 신규 실업수당 청구건수', impact: 'Medium', desc: '주간 고용 지표' },
    { dayOffset: 2, time: '03:00', country: '미국', raw: 'Federal Funds Rate', title: 'FOMC 통화정책 및 글로벌 중앙은행 동향', impact: 'High', desc: '글로벌 금리 및 유동성 방향성' }
  ];

  return standardEvents.map((item) => {
    const targetDate = new Date(year, month, date + item.dayOffset);
    const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(targetDate);
    const { sourceName, sourceUrl } = getEventSource(item.raw, item.country);
    return {
      timestamp: targetDate.getTime(),
      dateLabel,
      timeLabel: item.time,
      isToday: item.dayOffset === 0,
      isTomorrow: item.dayOffset === 1,
      country: item.country,
      title: `[${item.country}] ${item.title}`,
      impact: item.impact,
      forecast: '',
      previous: '',
      desc: item.desc,
      sourceName,
      sourceUrl
    };
  });
}

export async function events() {
  try {
    const response = await fetchFast('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { 'User-Agent': 'Mozilla/5.0 Economic-Briefing-Dashboard/1.0' }, 4500);
    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) throw new Error('No calendar events');

    const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayKstString = kstNow.toDateString();
    const tomorrowKst = new Date(kstNow.getTime() + 86400000);
    const tomorrowKstString = tomorrowKst.toDateString();

    const filtered = items.filter((x) => x.impact === 'High' || x.impact === 'Medium');
    const mapped = filtered.map((item) => {
      const d = new Date(item.date);
      const kstDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' }).format(d);
      const timeLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
      const isToday = kstDate.toDateString() === todayKstString;
      const isTomorrow = kstDate.toDateString() === tomorrowKstString;
      const countryName = COUNTRY_MAP[item.country] || item.country;
      const titleKo = EVENT_TRANSLATIONS[item.title] || item.title;
      const { sourceName, sourceUrl } = getEventSource(item.title, item.country);

      return {
        timestamp: d.getTime(),
        dateLabel,
        timeLabel,
        isToday,
        isTomorrow,
        country: countryName,
        title: `[${countryName}] ${titleKo}`,
        impact: item.impact,
        forecast: item.forecast || '',
        previous: item.previous || '',
        desc: item.forecast ? `예상: ${item.forecast} · 이전: ${item.previous || '-'}` : (item.previous ? `이전: ${item.previous}` : `${countryName} 주요 경제 일정`),
        sourceName,
        sourceUrl
      };
    });

    const upcoming = mapped.filter((x) => x.isToday || x.timestamp >= Date.now() - 3600000 * 12);
    return upcoming.length >= 3 ? upcoming.slice(0, 10) : mapped.slice(-8);
  } catch (error) {
    console.warn('Live calendar unavailable, using dynamic date fallback:', error.message);
    return getDynamicFallbackEvents();
  }
}
