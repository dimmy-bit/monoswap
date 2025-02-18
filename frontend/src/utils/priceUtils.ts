import axios from 'axios';

const CRYPTOCOMPARE_API_KEY = process.env.NEXT_PUBLIC_CRYPTOCOMPARE_API_KEY;
const BASE_URL = 'https://min-api.cryptocompare.com/data';

let priceCache: { [key: string]: { price: number; timestamp: number } } = {};
const CACHE_DURATION = 30000; // Increased to 30 seconds for better performance
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const BATCH_SIZE = 10;
const REQUEST_TIMEOUT = 10000; // 10 seconds timeout

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
}

async function fetchWithRetry(url: string, params: any, retries = MAX_RETRIES): Promise<any> {
  try {
    await rateLimit();
    const response = await axios.get(url, { 
      params,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
    return response.data;
  } catch (error: any) {
    if (retries > 0 && (error.response?.status >= 500 || error.code === 'ECONNABORTED')) {
      console.log(`Retrying request, ${retries} attempts left`);
      await delay(RETRY_DELAY);
      return fetchWithRetry(url, params, retries - 1);
    }
    throw error;
  }
}

export async function getTokenPrice(tokenSymbol: string, quoteSymbol: string = 'USD'): Promise<number> {
  try {
    console.log(`Fetching price for ${tokenSymbol}/${quoteSymbol}...`);
    
    // Check cache
    const cacheKey = `${tokenSymbol}-${quoteSymbol}`;
    const cachedData = priceCache[cacheKey];
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      console.log(`Using cached price for ${tokenSymbol}: ${cachedData.price}`);
      return cachedData.price;
    }

    const response = await axios.get(`${BASE_URL}/price`, {
      params: {
        fsym: tokenSymbol,
        tsyms: quoteSymbol,
        api_key: CRYPTOCOMPARE_API_KEY
      }
    });
    
    const price = response.data[quoteSymbol];
    console.log(`Fetched price for ${tokenSymbol}: ${price}`);
    
    // Update cache
    priceCache[cacheKey] = {
      price,
      timestamp: Date.now()
    };
    
    return price;
  } catch (error: any) {
    console.error('Error fetching price:', error);
    if (error.response) {
      console.error('API response:', error.response.data);
    }
    return 0;
  }
}

export async function getTokenPrices(tokenSymbols: string[], quoteSymbol: string = 'USD'): Promise<{[key: string]: number}> {
  try {
    console.log(`Fetching prices for tokens: ${tokenSymbols.join(', ')}`);
    
    // Check cache and collect expired entries
    const now = Date.now();
    const cachedPrices: {[key: string]: number} = {};
    const symbolsToFetch: string[] = [];
    const staleCache: {[key: string]: number} = {};

    tokenSymbols.forEach(symbol => {
      const cacheKey = `${symbol}-${quoteSymbol}`;
      const cachedData = priceCache[cacheKey];
      
      if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
        cachedPrices[symbol] = cachedData.price;
      } else if (cachedData) {
        staleCache[symbol] = cachedData.price;
        symbolsToFetch.push(symbol);
      } else {
        symbolsToFetch.push(symbol);
      }
    });

    // If all prices are cached, return immediately
    if (symbolsToFetch.length === 0) {
      return cachedPrices;
    }

    // Use stale cache while fetching new prices
    const result = { ...cachedPrices, ...staleCache };

    // Fetch in batches
    const batches = [];
    for (let i = 0; i < symbolsToFetch.length; i += BATCH_SIZE) {
      batches.push(symbolsToFetch.slice(i, i + BATCH_SIZE));
    }

    // Fetch all batches concurrently with rate limiting
    const batchPromises = batches.map(async (batch, index) => {
      if (index > 0) await delay(MIN_REQUEST_INTERVAL * index);
      try {
        const response = await fetchWithRetry(`${BASE_URL}/pricemulti`, {
          fsyms: batch.join(','),
          tsyms: quoteSymbol,
          api_key: CRYPTOCOMPARE_API_KEY
        });

        Object.entries(response).forEach(([symbol, prices]: [string, any]) => {
          const price = prices[quoteSymbol];
          const cacheKey = `${symbol}-${quoteSymbol}`;
          priceCache[cacheKey] = {
            price,
            timestamp: now
          };
          result[symbol] = price;
        });
      } catch (error) {
        console.error(`Error fetching batch ${index + 1}:`, error);
        // Keep stale cache for failed requests
        batch.forEach(symbol => {
          if (staleCache[symbol]) {
            result[symbol] = staleCache[symbol];
          }
        });
      }
    });

    await Promise.all(batchPromises);
    return result;
  } catch (error: any) {
    console.error('Error fetching prices:', error);
    // Return cached prices (including stale) or default values
    return tokenSymbols.reduce((acc, symbol) => {
      const cacheKey = `${symbol}-${quoteSymbol}`;
      const cachedData = priceCache[cacheKey];
      acc[symbol] = cachedData?.price || 0;
      return acc;
    }, {} as {[key: string]: number});
  }
} 