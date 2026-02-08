/**
 * Jupiter DEX Integration
 * 
 * Enables token swaps for accepting payments in any token
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

const JUPITER_API = 'https://quote-api.jup.ag/v6';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      // Server error, retry
    } catch (error) {
      if (i === retries - 1) throw error;
    }
    // Exponential backoff
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, i)));
  }
  throw new Error(`Failed after ${retries} retries`);
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactPct: number;
  routePlan: any[];
}

export interface SwapResult {
  txSignature: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
}

export class JupiterIntegration {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get a swap quote
   */
  async getQuote(params: {
    inputMint: PublicKey | string;
    outputMint: PublicKey | string;
    amount: number;
    slippageBps?: number;
  }): Promise<SwapQuote> {
    const inputMint = params.inputMint.toString();
    const outputMint = params.outputMint.toString();
    const amountLamports = Math.floor(params.amount * 1e9);
    const slippage = params.slippageBps || 50; // 0.5% default

    const url = new URL(`${JUPITER_API}/quote`);
    url.searchParams.set('inputMint', inputMint);
    url.searchParams.set('outputMint', outputMint);
    url.searchParams.set('amount', amountLamports.toString());
    url.searchParams.set('slippageBps', slippage.toString());

    const response = await fetchWithRetry(url.toString());
    
    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.statusText}`);
    }

    const quote = await response.json();

    return {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpactPct: parseFloat(quote.priceImpactPct),
      routePlan: quote.routePlan,
    };
  }

  /**
   * Get swap transaction
   */
  async getSwapTransaction(params: {
    quote: SwapQuote;
    userPublicKey: PublicKey;
    wrapUnwrapSOL?: boolean;
  }): Promise<VersionedTransaction> {
    const response = await fetchWithRetry(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: params.quote,
        userPublicKey: params.userPublicKey.toString(),
        wrapAndUnwrapSol: params.wrapUnwrapSOL ?? true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jupiter swap failed: ${response.statusText}`);
    }

    const { swapTransaction } = await response.json();
    const txBuffer = Buffer.from(swapTransaction, 'base64');
    return VersionedTransaction.deserialize(txBuffer);
  }

  /**
   * Execute a swap
   */
  async executeSwap(params: {
    inputMint: PublicKey | string;
    outputMint: PublicKey | string;
    amount: number;
    userPublicKey: PublicKey;
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  }): Promise<SwapResult> {
    // Get quote
    const quote = await this.getQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
    });

    // Get transaction
    const tx = await this.getSwapTransaction({
      quote,
      userPublicKey: params.userPublicKey,
    });

    // Sign
    const signedTx = await params.signTransaction(tx);

    // Send
    const signature = await this.connection.sendTransaction(signedTx);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return {
      txSignature: signature,
      inputAmount: parseInt(quote.inputAmount) / 1e9,
      outputAmount: parseInt(quote.outputAmount) / 1e9,
      priceImpact: quote.priceImpactPct,
    };
  }

  /**
   * Get token price in SOL
   */
  async getTokenPrice(tokenMint: PublicKey | string): Promise<number> {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    // Quote 1 SOL worth of the token
    try {
      const quote = await this.getQuote({
        inputMint: SOL_MINT,
        outputMint: tokenMint,
        amount: 1,
      });

      return parseInt(quote.outputAmount) / 1e9;
    } catch {
      return 0;
    }
  }

  /**
   * Convert any token payment to SOL
   */
  async convertToSOL(params: {
    tokenMint: PublicKey;
    amount: number;
    userPublicKey: PublicKey;
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  }): Promise<SwapResult> {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    return this.executeSwap({
      inputMint: params.tokenMint,
      outputMint: SOL_MINT,
      amount: params.amount,
      userPublicKey: params.userPublicKey,
      signTransaction: params.signTransaction,
    });
  }
}

// Well-known token mints
export const TOKENS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  BONK: new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
  JUP: new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),
};
