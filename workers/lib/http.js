const MAX_JSON_BODY_BYTES = 24 * 1024;

const SAFE_HTTPS_PROTOCOLS = new Set(['https:']);

function getPositiveIntegerEnv(value, fallback, min, max) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readJsonBody(request) {
    const contentType = String(request.headers.get('Content-Type') || '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
        throw new HttpError('Content-Type must be application/json', 415, { expose: true, code: 'unsupported_media_type' });
    }

    const rawBody = await readTextBodyWithLimit(request, MAX_JSON_BODY_BYTES);

    try {
        return JSON.parse(rawBody);
    } catch {
        throw new ValidationError('Invalid JSON');
    }
}

async function readTextBodyWithLimit(request, maxBytes) {
    const declaredLength = String(request.headers.get('Content-Length') || '').trim();
    if (/^\d+$/.test(declaredLength) && BigInt(declaredLength) > BigInt(maxBytes)) {
        throw payloadTooLargeError(maxBytes);
    }
    if (!request.body) return '';
    if (typeof request.body.getReader !== 'function') {
        throw new HttpError('Request body cannot be read safely', 400, {
            expose: true,
            code: 'unreadable_body'
        });
    }

    const reader = request.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            totalBytes += chunk.byteLength;
            if (totalBytes > maxBytes) {
                try {
                    await reader.cancel('payload too large');
                } catch (error) {
                    console.warn('Oversized request stream cancellation failed', error);
                }
                throw payloadTooLargeError(maxBytes);
            }
            chunks.push(chunk);
        }
    } finally {
        reader.releaseLock();
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(body);
}

function payloadTooLargeError(maxBytes) {
    return new HttpError(`JSON body must be at most ${maxBytes} bytes`, 413, {
        expose: true,
        code: 'payload_too_large'
    });
}

function assertPlainObject(value, fieldName) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
        throw new ValidationError(`${fieldName} must be a JSON object`);
    }
}

function normalizeTextField(value, fieldName, options = {}) {
    const {
        maxLength,
        required = false,
        defaultValue = '',
        multiline = false,
        forbidHtml = false
    } = options;
    let candidate = value;

    if (candidate === undefined || candidate === null || candidate === '') {
        candidate = defaultValue;
    }
    if (typeof candidate !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`);
    }
    if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]|[\u202A-\u202E\u2066-\u2069]/u.test(candidate)) {
        throw new ValidationError(`${fieldName} contains disallowed control characters`);
    }

    let normalized = candidate.replace(/\r\n?/g, '\n');
    normalized = multiline
        ? normalized.trim()
        : normalized.replace(/\s+/g, ' ').trim();
    if (!normalized && defaultValue) {
        normalized = String(defaultValue).trim();
    }

    if (required && !normalized) {
        throw new ValidationError(`${fieldName} is required`);
    }
    if (maxLength && normalized.length > maxLength) {
        throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`);
    }
    if (forbidHtml && /[<>]/u.test(normalized)) {
        throw new ValidationError(`${fieldName} must not contain HTML delimiters`);
    }
    return normalized;
}

function normalizeHttpUrl(value, fieldName, options = {}) {
    const {
        maxLength = 1000,
        required = false,
        protocols = SAFE_HTTPS_PROTOCOLS,
        allowedHostnames = null
    } = options;
    const candidate = normalizeTextField(value, fieldName, { maxLength, required });
    if (!candidate) return '';

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch {
        throw new ValidationError(`${fieldName} must be an absolute URL`);
    }
    if (!protocols.has(parsed.protocol)) {
        throw new ValidationError(`${fieldName} uses a disallowed URL scheme`);
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
        throw new ValidationError(`${fieldName} must not contain credentials and must include a hostname`);
    }
    if (allowedHostnames && ![...allowedHostnames].some(hostname => {
        return parsed.hostname === hostname || parsed.hostname.endsWith(`.${hostname}`);
    })) {
        throw new ValidationError(`${fieldName} uses a disallowed hostname`);
    }

    const normalized = parsed.toString();
    if (normalized.length > maxLength) {
        throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`);
    }
    return normalized;
}

async function createSubmissionKey(kind, payload, explicitKey = '') {
    const explicit = String(explicitKey || '').trim();
    if (explicit && !/^[A-Za-z0-9._:-]{8,128}$/.test(explicit)) {
        throw new ValidationError('Idempotency-Key must be 8-128 URL-safe characters');
    }
    const canonicalPayload = stableStringify(payload);
    const material = explicit ? `${explicit}\n${canonicalPayload}` : canonicalPayload;
    return `submission:${kind}:${await sha256Hex(material)}`;
}

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

async function sha256Hex(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function snapshotIssue(issue) {
    if (!issue?.html_url || !Number.isInteger(Number(issue.number))) {
        throw new Error('GitHub returned an invalid issue response');
    }
    return { number: Number(issue.number), html_url: String(issue.html_url) };
}

function snapshotDiscordMessage(message) {
    if (!message?.id) throw new Error('Discord returned an invalid message response');
    return { id: String(message.id), channel_id: message.channel_id ? String(message.channel_id) : undefined };
}

function safeErrorMessage(error) {
    return String(error?.message || 'unknown error')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[<>]/g, '')
        .slice(0, 240);
}

function suppressGitHubMentions(value) {
    return String(value || '').replace(/@(?=[A-Za-z0-9-])/g, '@\u200B');
}

function requireEnv(env, names) {
    const missing = names.filter(name => !env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
}

class HttpError extends Error {
    constructor(message, status, options = {}) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.expose = Boolean(options.expose);
        this.code = options.code;
        this.headers = options.headers;
    }
}

class ValidationError extends HttpError {
    constructor(message) {
        super(message, 400, { expose: true, code: 'validation_error' });
        this.name = 'ValidationError';
    }
}

function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            ...headers,
            'Content-Type': 'application/json; charset=utf-8'
        }
    });
}

function coordinatorResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff'
        }
    });
}

function htmlResponse(html, status, headers) {
    return new Response(html, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            ...headers,
            'Content-Type': 'text/html; charset=utf-8'
        }
    });
}

function encodeURIComponentPath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
}

function base64ToUtf8(value) {
    const binary = atob(value.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function utf8ToBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

export {
    HttpError,
    MAX_JSON_BODY_BYTES,
    SAFE_HTTPS_PROTOCOLS,
    ValidationError,
    assertPlainObject,
    base64ToUtf8,
    coordinatorResponse,
    createSubmissionKey,
    encodeURIComponentPath,
    escapeRegExp,
    getPositiveIntegerEnv,
    hexToBytes,
    htmlResponse,
    jsonResponse,
    normalizeHttpUrl,
    normalizeTextField,
    readJsonBody,
    readTextBodyWithLimit,
    requireEnv,
    safeErrorMessage,
    sha256Hex,
    snapshotDiscordMessage,
    snapshotIssue,
    suppressGitHubMentions,
    utf8ToBase64
};
