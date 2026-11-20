// Dry-run by default. Never executes when imported or by an existing deployment job.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function cleanupAccounts({ db, auth, cutoff, apply = false, limit = 100 }) {
    if (!(cutoff instanceof Date) || !Number.isFinite(cutoff.getTime()) || cutoff.getTime() > Date.now() - 24 * 60 * 60 * 1000) throw Error('삭제 표식은 최소 24시간 보관해야 합니다.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('한 번에 최대 100개 계정만 점검합니다.');
    const candidates = await db.collection('users').where('status', '==', 'deleting').where('deleteRequestedAt', '<', cutoff).limit(limit).get();
    const result = { checked: candidates.size, eligible: 0, deleted: 0, retainedAuthUsers: 0, apply };
    for (const candidate of candidates.docs) {
        // Failed Auth deletion must remain retryable. Permission errors must never mean "user missing".
        try { await auth.getUser(candidate.id); result.retainedAuthUsers++; continue; }
        catch (error) { if (error.code !== 'auth/user-not-found') throw Error('Auth 사용자 존재 여부를 확인하지 못해 정리를 중단했습니다.'); }
        result.eligible++;
        if (!apply) continue;
        const removed = await db.runTransaction(async tx => {
            const current = await tx.get(candidate.ref), data = current.data();
            const requestedAt = data?.deleteRequestedAt?.toMillis?.();
            if (!current.exists || data.status !== 'deleting' || !Number.isFinite(requestedAt) || requestedAt >= cutoff.getTime()) return false;
            tx.delete(candidate.ref.collection('state').doc('roster'));
            tx.delete(candidate.ref.collection('state').doc('parties'));
            tx.delete(candidate.ref); return true;
        });
        if (removed) result.deleted++;
    }
    return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const index = process.argv.indexOf('--project'), projectId = index < 0 ? null : process.argv[index + 1];
    if (!projectId || projectId.startsWith('--')) throw Error('--project를 명시해주세요. 기본 동작은 dry-run입니다.');
    const { initializeApp, applicationDefault, deleteApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');
    const app = initializeApp({ projectId, credential: applicationDefault() });
    try { console.log(JSON.stringify(await cleanupAccounts({ db: getFirestore(app), auth: getAuth(app), cutoff: new Date(Date.now() - 24 * 60 * 60 * 1000), apply: process.argv.includes('--apply') }))); }
    finally { await deleteApp(app); }
}
