import { requireEnv } from './http.js';
import {
    commitGitHubFilesAtomically,
    createGitHubRef,
    getGitHubFile,
    getGitHubRef,
    githubJsonFetch,
    updateGitHubRef
} from './github-adapter.js';
import {
    CHARACTER_MANIFEST_PATH,
    buildCharacterRegistry,
    normalizeTargets
} from './resource-schema.js';
import { buildResourceLinkShardUpdates } from '../../shared/runtime-data-shards.js';

const RESOURCE_LINKS_PATH = 'data/resource_links.json';

const RESOURCE_LINKS_PENDING_BRANCH = 'resource-links/pending';

const DEFAULT_BASE_BRANCH = 'main';

async function updateResourceLinks(env, link, targets, registry, injectedActions = null) {
    const actions = injectedActions || createResourceRepositoryActions(env);
    await actions.ensurePendingBranch();

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const head = await actions.getPendingRef();
            const expectedHeadSha = head?.object?.sha;
            if (!expectedHeadSha) {
                throw new Error(`Pending branch not found: ${RESOURCE_LINKS_PENDING_BRANCH}`);
            }
            const file = await actions.getFile(RESOURCE_LINKS_PATH, RESOURCE_LINKS_PENDING_BRANCH);
            const update = buildResourceLinksUpdate(file.content, link, targets, registry);
            const desiredShards = buildResourceLinkShardUpdates(
                update.content,
                [...update.added, ...update.skipped]
            );
            let unchangedShards = 0;
            let files = [];

            if (update.added.length > 0) {
                files = [
                    { path: RESOURCE_LINKS_PATH, content: update.content },
                    ...desiredShards.map(shard => ({ path: shard.path, content: shard.content }))
                ];
            } else {
                const staleShards = await findStaleResourceLinkShards(actions, desiredShards);
                unchangedShards = desiredShards.length - staleShards.length;
                files = staleShards.map(shard => ({ path: shard.path, content: shard.content }));
            }

            const commit = files.length > 0
                ? await actions.commitFiles(
                    RESOURCE_LINKS_PENDING_BRANCH,
                    expectedHeadSha,
                    {
                        message: `Update resource links: ${link.title.slice(0, 60)}`,
                        files
                    }
                )
                : null;

            const existingPr = await actions.findOpenPullRequest();
            let pr = existingPr;
            if (!pr && commit) {
                pr = await actions.ensurePullRequest();
            } else if (!pr) {
                const comparison = await actions.getBranchComparison();
                pr = comparison.ahead_by > 0
                    ? await actions.ensurePullRequest()
                    : null;
            }

            return {
                ...update,
                commitUrl: commit ? getCommitUrl(commit) : 'no changes',
                prUrl: pr?.html_url || 'already present on base branch',
                shardUpdates: files.filter(entry => entry.path !== RESOURCE_LINKS_PATH).length,
                shardUnchanged: unchangedShards
            };
        } catch (error) {
            if (attempt === 0 && isRetryableGitConflict(error)) continue;
            throw error;
        }
    }

    throw new Error('resource_links update failed after retry');
}

function createResourceRepositoryActions(env) {
    return {
        ensurePendingBranch: () => ensureResourceLinksPendingBranch(env),
        getPendingRef: () => getGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH),
        getFile: (path, ref) => getGitHubFile(env, path, ref),
        commitFiles: (branch, expectedHeadSha, data) => (
            commitGitHubFilesAtomically(env, branch, expectedHeadSha, data)
        ),
        findOpenPullRequest: () => findOpenResourceLinksPullRequest(env),
        getBranchComparison: () => getResourceLinksBranchComparison(env),
        ensurePullRequest: () => ensureResourceLinksPullRequest(env)
    };
}

async function findStaleResourceLinkShards(actions, updates) {
    const stale = [];
    for (const update of updates) {
        let file;
        try {
            file = await actions.getFile(update.path, RESOURCE_LINKS_PENDING_BRANCH);
        } catch (error) {
            if (error?.status === 404) {
                stale.push(update);
                continue;
            }
            throw error;
        }
        if (file.content !== update.content) stale.push(update);
    }
    return stale;
}

function getCommitUrl(commit) {
    return commit?.html_url || commit?.commit?.html_url || commit?.content?.html_url || 'unknown';
}

function isRetryableGitConflict(error) {
    if (error?.status === 409) return true;
    return error?.status === 422 && /fast[ -]?forward|reference update/i.test(String(error.message || ''));
}

function buildResourceLinksUpdate(content, link, targets, registry = null) {
    const db = JSON.parse(content);
    const uniqueTargets = normalizeTargets(targets, registry, { strict: true });
    const result = { added: [], skipped: [], missing: [] };
    let updatedContent = content;

    for (const target of uniqueTargets) {
        const list = getTargetList(db, target);
        if (!list) {
            result.missing.push(target);
            continue;
        }

        if (list.some(item => item && item.url === link.url)) {
            result.skipped.push(target);
            continue;
        }

        const insertion = buildResourceLinkInsertion(updatedContent, target, removeEmptyLinkFields(link));
        if (!insertion) {
            result.missing.push(target);
            continue;
        }

        updatedContent = insertion;
        list.unshift(removeEmptyLinkFields(link));
        result.added.push(target);
    }

    return {
        ...result,
        content: updatedContent
    };
}

function buildResourceLinkInsertion(content, target, link) {
    const listInfo = findTargetArray(content, target);
    if (!listInfo) return null;

    const lineStart = content.lastIndexOf('\n', listInfo.insertIndex - 1) + 1;
    const firstItemIndent = content.slice(lineStart, listInfo.insertIndex).match(/^\s*/)?.[0] || `${listInfo.indent}  `;
    const itemText = JSON.stringify(link, null, 2)
        .split('\n')
        .map((line, index) => index === 0 ? `${firstItemIndent}${line}` : `${firstItemIndent}${line}`)
        .join('\n');
    const comma = listInfo.hasItems ? ',\n' : '\n';

    return `${content.slice(0, listInfo.insertIndex)}${itemText}${comma}${content.slice(listInfo.insertIndex)}`;
}

function findTargetArray(content, target) {
    if (target.type === 'category') {
        const categoryKey = findJsonKey(content, target.id, content.indexOf('"categories"'));
        if (categoryKey < 0) return null;
        const categoryObjectStart = content.indexOf('{', categoryKey);
        const linksKey = findJsonKey(content, 'links', categoryObjectStart);
        if (linksKey < 0) return null;
        return getArrayInsertionInfo(content, content.indexOf('[', linksKey));
    }

    if (target.type === 'character') {
        const charactersKey = content.indexOf('"characters"');
        if (charactersKey < 0) return null;
        const characterKey = findJsonKey(content, target.id, charactersKey);
        if (characterKey < 0) return null;
        return getArrayInsertionInfo(content, content.indexOf('[', characterKey));
    }

    return null;
}

function findJsonKey(content, key, startIndex) {
    return content.indexOf(`"${escapeJsonString(key)}"`, Math.max(0, startIndex));
}

function getArrayInsertionInfo(content, arrayStart) {
    if (arrayStart < 0) return null;
    let cursor = arrayStart + 1;

    while (cursor < content.length && /\s/.test(content[cursor])) {
        cursor += 1;
    }

    const lineStart = content.lastIndexOf('\n', arrayStart) + 1;
    const indent = content.slice(lineStart, arrayStart).match(/^\s*/)?.[0] || '';

    return {
        insertIndex: cursor,
        hasItems: content[cursor] !== ']',
        indent
    };
}

function getTargetList(db, target) {
    if (target.type === 'category') {
        const category = db.categories?.[target.id];
        if (!category) return null;
        if (!Array.isArray(category.links)) category.links = [];
        return category.links;
    }

    if (target.type === 'character') {
        if (!db.characters) db.characters = {};
        if (!Array.isArray(db.characters[target.id])) db.characters[target.id] = [];
        return db.characters[target.id];
    }

    return null;
}

function removeEmptyLinkFields(link) {
    const result = {
        url: link.url,
        title: link.title,
        desc: link.desc || ''
    };
    if (link.image) result.image = link.image;
    return result;
}

function escapeJsonString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function ensureResourceLinksPendingBranch(env) {
    const baseBranch = getBaseBranch(env);
    const pendingRef = await getGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH);
    const baseRef = await getGitHubRef(env, baseBranch);
    if (!baseRef) {
        throw new Error(`Base branch not found: ${baseBranch}`);
    }

    if (!pendingRef) return createGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH, baseRef.object.sha);
    if (pendingRef.object.sha === baseRef.object.sha) return pendingRef;

    const comparison = await getResourceLinksBranchComparison(env);
    if (comparison.ahead_by > 0) {
        // A failed PR request must never make the next submission discard committed work.
        return pendingRef;
    }

    // This is a fast-forward only. A branch with unique commits is preserved above.
    return updateGitHubRef(env, RESOURCE_LINKS_PENDING_BRANCH, baseRef.object.sha, false);
}

async function getResourceLinksBranchComparison(env) {
    const base = encodeURIComponent(getBaseBranch(env));
    const head = encodeURIComponent(RESOURCE_LINKS_PENDING_BRANCH);
    const response = await githubJsonFetch(env, `/compare/${base}...${head}`, { method: 'GET' });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub branch comparison failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    const comparison = await response.json();
    return {
        status: comparison.status,
        ahead_by: Number(comparison.ahead_by) || 0,
        behind_by: Number(comparison.behind_by) || 0
    };
}

async function ensureResourceLinksPullRequest(env) {
    const existing = await findOpenResourceLinksPullRequest(env);
    if (existing) return existing;

    const baseBranch = getBaseBranch(env);
    const response = await githubJsonFetch(env, '/pulls', {
        method: 'POST',
        body: {
            title: 'Update resource links',
            head: RESOURCE_LINKS_PENDING_BRANCH,
            base: baseBranch,
            body: [
                'Automated batch PR for approved resource_links updates.',
                '',
                '- Source: Discord approval workflow',
                `- Branch: ${RESOURCE_LINKS_PENDING_BRANCH}`,
                '- Merge this PR manually after review.'
            ].join('\n')
        }
    });

    if (response.status === 422) {
        const retry = await findOpenResourceLinksPullRequest(env);
        if (retry) return retry;
    }

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub PR creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function findOpenResourceLinksPullRequest(env) {
    const baseBranch = getBaseBranch(env);
    const params = new URLSearchParams({
        state: 'open',
        head: `${env.GITHUB_OWNER}:${RESOURCE_LINKS_PENDING_BRANCH}`,
        base: baseBranch,
        per_page: '10'
    });
    const response = await githubJsonFetch(env, `/pulls?${params.toString()}`, { method: 'GET' });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub PR search failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const pulls = await response.json();
    return pulls[0] || null;
}

async function getResourceCharacterRegistry(env) {
    requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
    const file = await getGitHubFile(env, CHARACTER_MANIFEST_PATH, getBaseBranch(env));
    let manifest;
    try {
        manifest = JSON.parse(file.content);
    } catch {
        throw new Error(`${CHARACTER_MANIFEST_PATH} is not valid JSON`);
    }
    return buildCharacterRegistry(manifest);
}

function getBaseBranch(env) {
    return String(env.GITHUB_BASE_BRANCH || DEFAULT_BASE_BRANCH).trim() || DEFAULT_BASE_BRANCH;
}

export {
    RESOURCE_LINKS_PENDING_BRANCH,
    buildResourceLinksUpdate,
    getResourceCharacterRegistry,
    updateResourceLinks
};
