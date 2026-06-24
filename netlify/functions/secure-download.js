// netlify/functions/secure-download.js
const axios = require('axios');

exports.handler = async (event, context) => {
    // Sécurité : On accepte uniquement les requêtes POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { packageId, walletAddress } = JSON.parse(event.body);

        if (!packageId || !walletAddress) {
            return { statusCode: 400, body: JSON.stringify({ error: "Paramètres manquants." }) };
        }

        // Mapping de tes verrous (Locks) Unlock Protocol sur Solana
        const lockMapping = {
            'kit-discord': '0xAdresseLockDiscordIci',
            'kit-telegram': '0xAdresseLockTelegramIci',
            'kit-ultimate': '0xAdresseLockUltimateIci',
            'boilerplate': '0xAdresseLockBoilerplateIci'
        };

        const targetLock = lockMapping[packageId];
        if (!targetLock) {
            return { statusCode: 404, body: JSON.stringify({ error: "Package introuvable." }) };
        }

        // Interrogation de l'API Unlock pour vérifier la possession réelle de la clé
        const unlockVerificationUrl = `https://api.unlock-protocol.com/api/key/${targetLock}/${walletAddress}`;
        let hasValidKey = false;

        try {
            const check = await axios.get(unlockVerificationUrl);
            if (check.data && check.data.owner === walletAddress) {
                hasValidKey = true;
            }
        } catch (e) {
            hasValidKey = false; 
        }

        // AVERTISSEMENT : Pour tes tests locaux ou avant d'avoir créé tes vrais locks, 
        // tu peux décommenter la ligne suivante pour forcer le téléchargement :
        // hasValidKey = true;

        if (!hasValidKey) {
            return { statusCode: 403, body: JSON.stringify({ error: "CRYPTOGRAPHIC_KEY_INVALID" }) };
        }

        // URLs privées de stockage de tes scripts (Ex: Serveur privé, Bucket AWS S3 ou dossier caché)
        const secureStorage = {
            'kit-discord': 'https://ton-stockage-prive.com/archives/solana-discord-bot.zip',
            'kit-telegram': 'https://ton-stockage-prive.com/archives/solana-telegram-bot.zip',
            'kit-ultimate': 'https://ton-stockage-prive.com/archives/solana-ultimate-pack.zip',
            'boilerplate': 'https://ton-stockage-prive.com/archives/solana-boilerplates.zip'
        };

        return {
            statusCode: 200,
            body: JSON.stringify({ downloadUrl: secureStorage[packageId] })
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "GATEWAY_ERROR" }) };
    }
};