import axios from 'axios';

const CRYPTOCOMPARE_API_KEY = process.env.NEXT_PUBLIC_CRYPTOCOMPARE_API_KEY;
const BASE_URL = 'https://min-api.cryptocompare.com/data';

let priceCache: { [key: string]: { price: number; timestamp: number } } = {};
const CACHE_DURATION = 15000; // 15 seconds

export async function getTokenPrice(tokenSymbol: string, quoteSymbol: string = 'USD'): Promise<number> {
  try {
    // Check cache
    const cacheKey = `${tokenSymbol}-${quoteSymbol}`;
    const cachedData = priceCache[cacheKey];
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.price;
    }

    const response = await axios.get(`${BASE_URL}/price`, {
      params: {
        fsym: tokenSymbol,
        tsyms: quoteSymbol,
      },
      headers: {
        'authorization': `Apikey ${CRYPTOCOMPARE_API_KEY}`
      }
    });
    
    const price = response.data[quoteSymbol];
    
    // Update cache
    priceCache[cacheKey] = {
      price,
      timestamp: Date.now()
    };
    
    return price;
  } catch (error) {
    console.error('Error fetching price:', error);
    return 0;
  }
}

export async function getTokenPrices(tokenSymbols: string[], quoteSymbol: string = 'USD'): Promise<{[key: string]: number}> {
  try {
    // Check cache for all tokens
    const now = Date.now();
    const cachedPrices: {[key: string]: number} = {};
    const symbolsToFetch: string[] = [];

    tokenSymbols.forEach(symbol => {
      const cacheKey = `${symbol}-${quoteSymbol}`;
      const cachedData = priceCache[cacheKey];
      if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
        cachedPrices[symbol] = cachedData.price;
      } else {
        symbolsToFetch.push(symbol);
      }
    });

    if (symbolsToFetch.length === 0) {
      return cachedPrices;
    }

    const response = await axios.get(`${BASE_URL}/pricemulti`, {
      params: {
        fsyms: symbolsToFetch.join(','),
        tsyms: quoteSymbol,
      },
      headers: {
        'authorization': `Apikey ${CRYPTOCOMPARE_API_KEY}`
      }
    });
    
    // Update cache and merge with cached prices
    const fetchedPrices = Object.fromEntries(
      Object.entries(response.data).map(([symbol, prices]: [string, any]) => {
        const price = prices[quoteSymbol];
        priceCache[`${symbol}-${quoteSymbol}`] = {
          price,
          timestamp: now
        };
        return [symbol, price];
      })
    );
    
    return { ...cachedPrices, ...fetchedPrices };
  } catch (error) {
    console.error('Error fetching prices:', error);
    return {};
  }
} 