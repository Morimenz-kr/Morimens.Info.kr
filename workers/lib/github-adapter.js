import {
    HttpError,
    base64ToUtf8,
    encodeURIComponentPath,
    suppressGitHubMentions,
    utf8ToBase64
} from './http.js';

async function createGitHubIssueWithOptionalLabels(env, issuePayload) {
    const safeIssuePayload = {
        ...issuePayload,
        title: suppressGitHubMentions(issuePayload.title),
        body: suppressGitHubMentions(issuePayload.body)
    };
    let response = await githubJsonFetch(env, '/issues', {
        method: 'POST',
        body: safeIssuePayload
    });

    if (response.status === 422 && safeIssuePayload.labels) {
        const fallback = { ...safeIssuePayload };
        delete fallback.labels;
        response = await githubJsonFetch(env, '/issues', {
            method: 'POST',
            body: fallback
        });
    }

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function getGitHubIssue(env, issueNumber) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}`, { method: 'GET' });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue fetch failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function updateGitHubIssueBody(env, issueNumber, body) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}`, {
        method: 'PATCH',
        body: { body }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue update failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function commentGitHubIssue(env, issueNumber, body) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}/comments`, {
        method: 'POST',
        body: { body: suppressGitHubMentions(body) }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue comment failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function closeGitHubIssue(env, issueNumber) {
    const response = await githubJsonFetch(env, `/issues/${issueNumber}`, {
        method: 'PATCH',
        body: { state: 'closed' }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub issue close failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function getGitHubRef(env, branch) {
    const response = await githubJsonFetch(env, `/git/ref/heads/${encodeURIComponentPath(branch)}`, { method: 'GET' });
    if (response.status === 404) return null;
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub ref fetch failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return response.json();
}

async function createGitHubRef(env, branch, sha) {
    const response = await githubJsonFetch(env, '/git/refs', {
        method: 'POST',
        body: {
            ref: `refs/heads/${branch}`,
            sha
        }
    });

    if (response.status === 422) {
        const ref = await getGitHubRef(env, branch);
        if (ref) return ref;
    }

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub ref creation failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    return response.json();
}

async function updateGitHubRef(env, branch, sha, force) {
    const response = await githubJsonFetch(env, `/git/refs/heads/${encodeURIComponentPath(branch)}`, {
        method: 'PATCH',
        body: {
            sha,
            force
        }
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new HttpError(`GitHub ref update failed: ${response.status} ${detail.slice(0, 300)}`, response.status);
    }

    return response.json();
}

async function commitGitHubFilesAtomically(env, branch, expectedHeadSha, data) {
    const files = normalizeGitTreeFiles(data?.files);
    const message = suppressGitHubMentions(String(data?.message || '').trim()).slice(0, 200);
    if (!message) throw new Error('GitHub commit message is required');
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(String(expectedHeadSha || ''))) {
        throw new Error('A valid expected GitHub branch head SHA is required');
    }

    const baseCommitResponse = await githubJsonFetch(
        env,
        `/git/commits/${encodeURIComponent(expectedHeadSha)}`,
        { method: 'GET' }
    );
    const baseCommit = await requireGitHubJson(baseCommitResponse, 'GitHub base commit lookup');
    if (!baseCommit.tree?.sha) throw new Error('GitHub base commit has no tree SHA');

    const treeResponse = await githubJsonFetch(env, '/git/trees', {
        method: 'POST',
        body: {
            base_tree: baseCommit.tree.sha,
            tree: files.map(file => ({
                path: file.path,
                mode: '100644',
                type: 'blob',
                content: file.content
            }))
        }
    });
    const tree = await requireGitHubJson(treeResponse, 'GitHub tree creation');
    if (!tree.sha) throw new Error('GitHub tree creation returned no SHA');

    const commitResponse = await githubJsonFetch(env, '/git/commits', {
        method: 'POST',
        body: {
            message,
            tree: tree.sha,
            parents: [expectedHeadSha]
        }
    });
    const commit = await requireGitHubJson(commitResponse, 'GitHub commit creation');
    if (!commit.sha) throw new Error('GitHub commit creation returned no SHA');

    // The branch advances once, only after one tree contains every intended file.
    // A concurrent writer produces 409 because force=false, and the caller rebuilds
    // the complete tree from the new head before retrying.
    const ref = await updateGitHubRef(env, branch, commit.sha, false);
    return { ...commit, ref };
}

function normalizeGitTreeFiles(files) {
    if (!Array.isArray(files) || files.length === 0 || files.length > 100) {
        throw new Error('Atomic GitHub commit requires 1-100 files');
    }

    const normalized = [];
    const seen = new Set();
    let totalBytes = 0;
    for (const file of files) {
        const path = String(file?.path || '');
        if (!path
            || path.length > 300
            || path.startsWith('/')
            || path.includes('\\')
            || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
            throw new Error(`Unsafe GitHub tree path: ${path}`);
        }
        if (seen.has(path)) throw new Error(`Duplicate GitHub tree path: ${path}`);
        seen.add(path);
        if (typeof file.content !== 'string') {
            throw new Error(`GitHub tree content must be text: ${path}`);
        }
        totalBytes += new TextEncoder().encode(file.content).byteLength;
        normalized.push({ path, content: file.content });
    }
    if (totalBytes > 4 * 1024 * 1024) {
        throw new Error('Atomic GitHub commit content exceeds 4 MiB');
    }
    return normalized;
}

async function requireGitHubJson(response, operation) {
    if (!response.ok) {
        const detail = await response.text();
        throw new HttpError(`${operation} failed: ${response.status} ${detail.slice(0, 300)}`, response.status);
    }
    return response.json();
}

async function getGitHubFile(env, path, ref) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const response = await githubJsonFetch(env, `/contents/${encodeURIComponentPath(path)}${query}`, { method: 'GET' });
    if (!response.ok) {
        const detail = await response.text();
        throw new HttpError(`GitHub file fetch failed: ${response.status} ${detail.slice(0, 300)}`, response.status);
    }

    const data = await response.json();
    return {
        sha: data.sha,
        content: base64ToUtf8(data.content || '')
    };
}

async function putGitHubFile(env, path, data) {
    const response = await githubJsonFetch(env, `/contents/${encodeURIComponentPath(path)}`, {
        method: 'PUT',
        body: {
            message: data.message,
            content: utf8ToBase64(data.content),
            sha: data.sha,
            branch: data.branch
        }
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new HttpError(`GitHub file update failed: ${response.status} ${detail.slice(0, 300)}`, response.status);
    }
    return response.json();
}

function githubJsonFetch(env, path, options) {
    return fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`, {
        method: options.method,
        signal: AbortSignal.timeout(30_000),
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'morimens-feedback-worker',
            'X-GitHub-Api-Version': '2026-03-10'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
}

export {
    closeGitHubIssue,
    commentGitHubIssue,
    commitGitHubFilesAtomically,
    createGitHubIssueWithOptionalLabels,
    createGitHubRef,
    getGitHubFile,
    getGitHubIssue,
    getGitHubRef,
    githubJsonFetch,
    putGitHubFile,
    updateGitHubIssueBody,
    updateGitHubRef
};
