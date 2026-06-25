const { Connection, PublicKey } = require('@solana/web3.js');
const Redis = require('ioredis');

// Initialisation via les variables d'environnement Netlify
const redis = new Redis(process.env.UPSTASH_REDIS_URL);
const solana = new Connection(process.env.HELIUS_RPC_URL, 'confirmed');

const TREASURY_ADDRESS = process.env.TREASURY_WALLET; 
const USDC_MINT = "EPjFW3dp257eaD1Cw715lQJ459WFinDQ63198UXISsg"; 
const MAX_AGE_SECONDS = 600; // 10 minutes max

// Dictionnaire exact de tes 4 produits
const PRODUCTS = {
    'kit-discord': { price: 39000000 },
    'kit-telegram': { price: 39000000 },
    'kit-ultimate': { price: 59000000 },
    'kit-boilerplate': { price: 29000000 } // Ajout du Kit 4 (29 USDC par exemple)
};

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { signature, packageId, userWallet } = JSON.parse(event.body);

        // 1. FILTRE DE FORME
        if (!signature || !/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature)) {
            return { statusCode: 400, body: JSON.stringify({ error: "INVALID_SIGNATURE_FORMAT" }) };
        }
        if (!PRODUCTS[packageId]) {
            return { statusCode: 400, body: JSON.stringify({ error: "UNKNOWN_PRODUCT" }) };
        }

        // 2. FILTRE ANTI-REJEU (Redis)
        const isReplay = await redis.get(`sig:${signature}`);
        if (isReplay) return { statusCode: 403, body: JSON.stringify({ error: "REPLAY_ATTACK_BLOCKED" }) };

        // 3. LECTURE BLOCKCHAIN (Helius)
        const tx = await solana.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return { statusCode: 404, body: JSON.stringify({ error: "TRANSACTION_NOT_FOUND" }) };

        // 4. VÉRIFICATION DU TEMPS
        const currentUnixTime = Math.floor(Date.now() / 1000);
        if ((currentUnixTime - tx.blockTime) > MAX_AGE_SECONDS) {
            return { statusCode: 403, body: JSON.stringify({ error: "TRANSACTION_EXPIRED" }) };
        }

        // 5. & 6. VÉRIFICATION FINANCIÈRE & IDENTITÉ
        let isValidPayment = false;
        const preTokenBalances = tx.meta.preTokenBalances || [];
        const postTokenBalances = tx.meta.postTokenBalances || [];

        const treasuryPostBalance = postTokenBalances.find(b => b.owner === TREASURY_ADDRESS && b.mint === USDC_MINT);
        const treasuryPreBalance = preTokenBalances.find(b => b.owner === TREASURY_ADDRESS && b.mint === USDC_MINT);
        
        const amountReceived = (treasuryPostBalance?.uiTokenAmount?.uiAmount || 0) - (treasuryPreBalance?.uiTokenAmount?.uiAmount || 0);
        const expectedUiAmount = PRODUCTS[packageId].price / 1000000;

        const isUserSigner = tx.transaction.message.accountKeys.some((account, index) => 
            account.pubkey.toBase58() === userWallet && tx.transaction.message.isAccountSigner(index)
        );

        if (amountReceived >= expectedUiAmount && isUserSigner) isValidPayment = true;

        if (!isValidPayment) return { statusCode: 403, body: JSON.stringify({ error: "PAYMENT_VALIDATION_FAILED" }) };

        // 7. VERROUILLAGE SÉCURITÉ
        await redis.set(`sig:${signature}`, "consumed", "EX", MAX_AGE_SECONDS);

        // 8. DÉLIVRANCE (URLs secrètes factices à remplacer par tes vrais liens)
        const directSecretUrls = {
            'kit-discord': 'https://ton-stockage.com/solana-discord-bot.zip',
            'kit-telegram': 'https://ton-stockage.com/solana-telegram-bot.zip',
            'kit-ultimate': 'https://ton-stockage.com/solana-ultimate-pack.zip',
            'kit-boilerplate': 'https://ton-stockage.com/solana-boilerplates.zip'
        };

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secureUrl: directSecretUrls[packageId] })
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "INTERNAL_CRYPTO_GATEWAY_ERROR" }) };
    }
};