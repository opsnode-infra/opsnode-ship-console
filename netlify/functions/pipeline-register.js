// netlify/functions/pipeline-register.js
const axios = require('axios');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { email, product } = JSON.parse(event.body);

        if (!email || !product) {
            return { statusCode: 400, body: JSON.stringify({ error: "Données incomplètes." }) };
        }

        // Tu configures cette variable d'environnement directement dans l'interface de Netlify 
        // (Site settings -> Environment variables) pour qu'elle n'apparaisse JAMAIS sur ton GitHub public.
        const DISCORD_LOGS_WEBHOOK = process.env.PRIVATE_DISCORD_PIPELINE_WEBHOOK;

        if (DISCORD_LOGS_WEBHOOK) {
            await axios.post(DISCORD_LOGS_WEBHOOK, {
                content: `🚨 **[OPSNODE_PIPELINE]** \nNouvelle demande d'accès Alpha : \`${email}\` \nProduit ciblé : \`${product}\``
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ status: "TARGET_LOCKED" })
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "REGISTRY_DOWN" }) };
    }
};