import { hexToBytes, normalizeHttpUrl } from './http.js';

const SAFE_DISCORD_WEBHOOK_HOSTS = new Set(['discord.com', 'discordapp.com']);

async function postDiscordWebhook(env, payload) {
    const webhookUrl = normalizeHttpUrl(env.DISCORD_WEBHOOK_URL, 'DISCORD_WEBHOOK_URL', {
        maxLength: 1000,
        required: true,
        allowedHostnames: SAFE_DISCORD_WEBHOOK_HOSTS
    });
    return fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } })
    });
}

async function postDiscordChannelMessage(env, payload) {
    const response = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: discordBotHeaders(env),
        body: JSON.stringify({ ...payload, allowed_mentions: { parse: [] } })
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord channel message failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function editDiscordMessage(env, interaction, payload) {
    const channelId = interaction.channel_id || interaction.message?.channel_id;
    const messageId = interaction.message?.id;
    if (!channelId || !messageId) return null;

    const safePayload = {
        ...payload,
        allowed_mentions: { parse: [] }
    };

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: discordBotHeaders(env),
        body: JSON.stringify(safePayload)
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Discord message edit failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function verifyDiscordRequest(request, rawBody, env) {
    if (!env.DISCORD_PUBLIC_KEY) return false;

    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    if (!signature || !timestamp) return false;
    if (!/^[0-9a-f]{128}$/i.test(signature) || !/^[0-9a-f]{64}$/i.test(String(env.DISCORD_PUBLIC_KEY))) {
        return false;
    }
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 5 * 60) {
        return false;
    }

    try {
        const key = await crypto.subtle.importKey(
            'raw',
            hexToBytes(env.DISCORD_PUBLIC_KEY),
            { name: 'Ed25519', namedCurve: 'Ed25519' },
            false,
            ['verify']
        );

        return crypto.subtle.verify(
            'Ed25519',
            key,
            hexToBytes(signature),
            new TextEncoder().encode(timestamp + rawBody)
        );
    } catch (error) {
        console.warn('Discord signature verification failed', error);
        return false;
    }
}

function discordBotHeaders(env) {
    return {
        'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
    };
}

function interactionResponse(type, data) {
    const body = data
        ? { type, data: { ...data, allowed_mentions: { parse: [] } } }
        : { type };
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff'
        }
    });
}

export {
    editDiscordMessage,
    interactionResponse,
    postDiscordChannelMessage,
    postDiscordWebhook,
    verifyDiscordRequest
};
