import { base64ToUtf8, utf8ToBase64 } from './http.js';
import {
    defaultResourceSelection,
    normalizeResourceProposal,
    normalizeResourceSelection
} from './resource-schema.js';

const RESOURCE_PROPOSAL_MARKER = 'resource-link-proposal';

const RESOURCE_SELECTION_MARKER = 'resource-link-selection';

function extractResourceSelection(body, registry = null) {
    const encodedRegex = new RegExp(`<!--\\s*${RESOURCE_SELECTION_MARKER}:([A-Za-z0-9+/=]+)\\s*-->`);
    const encodedMatch = body.match(encodedRegex);
    if (!encodedMatch) return defaultResourceSelection();

    try {
        return normalizeResourceSelection(JSON.parse(base64ToUtf8(encodedMatch[1])), registry);
    } catch {
        return defaultResourceSelection();
    }
}

function upsertResourceSelection(body, selection, registry = null) {
    const marker = `<!-- ${RESOURCE_SELECTION_MARKER}:${utf8ToBase64(JSON.stringify(normalizeResourceSelection(selection, registry)))} -->`;
    const markerRegex = new RegExp(`<!--\\s*${RESOURCE_SELECTION_MARKER}:[A-Za-z0-9+/=]+\\s*-->`);
    if (markerRegex.test(body)) {
        return body.replace(markerRegex, marker);
    }
    return `${body}\n${marker}`;
}

function extractResourceProposal(body, registry) {
    const encodedRegex = new RegExp(`<!--\\s*${RESOURCE_PROPOSAL_MARKER}:([A-Za-z0-9+/=]+)\\s*-->`);
    const encodedMatch = body.match(encodedRegex);
    if (encodedMatch) {
        return normalizeResourceProposal(JSON.parse(base64ToUtf8(encodedMatch[1])), registry);
    }

    const regex = new RegExp(`<!--\\s*${RESOURCE_PROPOSAL_MARKER}\\s*([\\s\\S]*?)\\s*-->`);
    const match = body.match(regex);
    if (!match) throw new Error('Resource proposal payload not found in issue body');
    return normalizeResourceProposal(JSON.parse(match[1]), registry);
}

export {
    RESOURCE_PROPOSAL_MARKER,
    extractResourceProposal,
    extractResourceSelection,
    upsertResourceSelection
};
