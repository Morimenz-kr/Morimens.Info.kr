import './account-store.js';
import { AccountSync } from './account-sync.mjs';
import { createFirebaseDriver } from './account-firebase.mjs';

const C = window.MorimensAccountStore, store = C.store;
const host = document.querySelector('[data-account-panel]');
if (host) start();

async function start() {
    host.classList.add('account-panel');
    host.innerHTML = `<div class="account-summary"><strong data-account-name>기기에 저장</strong><span data-account-status role="status" aria-live="polite">로그인하지 않아도 사용할 수 있습니다.</span></div><button type="button" data-account-open>Google로 로그인</button>`;
    const dialog = document.createElement('dialog'); dialog.className = 'account-dialog'; dialog.setAttribute('aria-labelledby', 'account-title');
    dialog.innerHTML = `<form method="dialog" class="account-dialog-header"><h2 id="account-title">내 계정</h2><button aria-label="계정 창 닫기" value="close">닫기</button></form>
        <div class="account-dialog-body"><p data-account-message role="status" aria-live="polite"></p>
        <section data-account-login><p>Google 계정에 보유 현황과 파티를 저장하고 다른 기기에서 불러옵니다. 기존 브라우저 기록은 로그인 후 선택해서 가져옵니다.</p><button type="button" data-account-google>Google로 로그인</button>
        <form data-account-test hidden><label>로컬 테스트 이메일<input name="email" type="email" autocomplete="username" required></label><label>테스트 비밀번호<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button name="action" value="login">테스트 로그인</button><button name="action" value="create">테스트 계정 만들기</button></form></section>
        <section data-account-member hidden><form data-account-profile><label for="account-game-uid">게임 UID (선택)</label><input id="account-game-uid" name="gameUid" maxlength="64" autocomplete="off"><button>프로필 저장</button></form>
        <p>UID만으로 게임 보유 현황을 조회하지 않습니다.</p><div class="account-actions"><button type="button" data-account-save>지금 저장</button><button type="button" data-account-refresh>다시 불러오기</button><button type="button" data-account-import>이 브라우저 기록 가져오기</button><button type="button" data-account-backup>계정 기록 백업</button><button type="button" data-account-logout>로그아웃</button></div>
        <details class="account-removal"><summary>계정 삭제</summary><p>계정의 보유·파티·게임 UID를 삭제합니다. 이 브라우저의 비로그인 기록은 유지됩니다. 다른 기기의 지연 저장을 막는 삭제 표식은 정리 전까지 일시 보관됩니다.</p><label><input type="checkbox" data-account-delete-check>계정 기록 삭제를 확인했습니다.</label><button type="button" data-account-delete>계정 삭제 계속</button></details></section>
        <section data-account-import-options hidden><h3>이 브라우저 기록 가져오기</h3><p>다른 사이트 주소·컴퓨터의 기록은 해당 주소·기기에서 가져와야 합니다. 원본 브라우저 기록은 유지됩니다.</p><p data-account-import-summary></p><div class="account-actions"><button type="button" data-import-mode="add">계정 값 유지하고 추가</button><button type="button" data-import-mode="replace">브라우저 기록으로 교체</button><button type="button" data-import-mode="skip">나중에</button></div></section>
        <section data-account-conflict hidden><h3>다른 기기의 수정과 겹칩니다</h3><p>겹치지 않는 변경은 합칩니다. 겹치는 항목에 적용할 값을 선택해주세요.</p><ul data-account-conflict-paths></ul><div class="account-actions"><button type="button" data-conflict="local">이 기기의 변경 유지</button><button type="button" data-conflict="remote">다른 기기의 변경 유지</button></div></section>
        <p class="account-note">변경은 먼저 이 기기에 보관되고 잠시 후 동기화됩니다. 창을 닫기 전 저장 상태를 확인해주세요. 로그아웃해도 미전송 기록은 해당 계정의 기기 저장소에 남습니다.</p></div>`;
    document.body.append(dialog);
    const q = selector => dialog.querySelector(selector);
    const button = host.querySelector('[data-account-open]');
    let driver, sync, user = null, busy = false, importData = null, returnFocus;
    const labels = { guest: '기기에 저장', loading: '계정 기록 확인 중', pending: '기기 저장됨 · 동기화 대기', saving: '동기화 중', saved: '동기화 완료', error: '동기화 확인 필요', conflict: '수정 충돌 확인 필요', deleting: '계정 삭제 진행 중' };
    function open() { returnFocus = document.activeElement; if (!dialog.open) dialog.showModal(); }
    dialog.addEventListener('close', () => { returnFocus?.focus(); });
    function message(text) { q('[data-account-message]').textContent = text; }
    function render(event = { state: 'guest' }) {
        host.querySelector('[data-account-name]').textContent = user?.displayName || user?.email || (user ? '내 계정' : '기기에 저장');
        host.querySelector('[data-account-status]').textContent = event.message || labels[event.state];
        button.textContent = user ? '내 계정' : 'Google로 로그인'; button.disabled = !driver;
        q('[data-account-login]').hidden = !!user; q('[data-account-member]').hidden = !user;
        q('[data-account-conflict]').hidden = !event.conflict;
        q('[data-account-conflict-paths]').replaceChildren(...(event.conflict?.paths || []).slice(0, 20).map(path => { const li = document.createElement('li'); li.textContent = path; return li; }));
        const locked = busy || ['loading', 'saving', 'deleting'].includes(event.state);
        for (const selector of ['[data-account-save]', '[data-account-refresh]', '[data-account-import]', '[data-account-profile] button']) q(selector).disabled = locked;
        q('[data-account-delete]').disabled = busy || !q('[data-account-delete-check]').checked || event.state === 'loading';
        if (event.message) message(event.message);
        if (event.state === 'deleting') { q('[data-account-delete]').textContent = '계정 삭제 다시 시도'; q('[data-account-delete]').disabled = busy || !q('[data-account-delete-check]').checked; }
        if (event.conflict) open();
    }
    async function action(fn) {
        if (busy) return;
        busy = true; render({ state: sync?.state || 'guest', conflict: sync?.conflict });
        try { await fn(); } catch (error) { message(sync?.message(error) || error.message || '작업을 마치지 못했습니다.'); }
        finally { busy = false; render({ state: sync?.state || 'guest', conflict: sync?.conflict }); }
    }
    button.addEventListener('click', open);
    function prepareImport() {
        const roster = store.guest('roster'), parties = store.guest('parties');
        importData = { roster, parties };
        q('[data-account-import-summary]').textContent = `각성체 기록 ${Object.keys(roster.characters).length}개 · 명륜 기록 ${Object.keys(roster.wheels).length}개 · 파티 페이지 ${parties.length}개`;
        q('[data-account-import-options]').hidden = false; open();
    }
    q('[data-account-profile]').addEventListener('submit', event => {
        event.preventDefault(); action(async () => { await sync.updateGameUid(q('#account-game-uid').value); message('프로필을 저장했습니다.'); });
    });
    q('[data-account-save]').onclick = () => action(() => sync.flush());
    q('[data-account-refresh]').onclick = () => action(() => sync.refresh());
    q('[data-account-import]').onclick = () => action(prepareImport);
    q('[data-account-delete-check]').onchange = () => render({ state: sync?.state || 'guest' });
    q('[data-account-delete]').onclick = () => { if (q('[data-account-delete-check]').checked) action(() => sync.deleteAccount()); };
    q('[data-account-logout]').onclick = () => action(() => driver.logout());
    q('[data-account-backup]').onclick = () => action(() => {
        const blob = new Blob([JSON.stringify({ version: 1, roster: store.read('roster'), parties: store.read('parties'), gameUid: sync.profile?.gameUid ?? null }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'morimens-account-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    for (const node of dialog.querySelectorAll('[data-conflict]')) node.onclick = () => action(async () => { sync.resolve(node.dataset.conflict); await sync.flush(); });
    for (const node of dialog.querySelectorAll('[data-import-mode]')) node.onclick = () => action(async () => {
        if (!store.uid || store.blocked || sync.conflict) throw Error('계정 기록과 충돌을 먼저 확인해주세요.');
        const marker = `morimens_account_import_v1:${store.uid}`;
        if (node.dataset.importMode !== 'skip') {
            if (!importData) throw Error('가져올 기록을 다시 확인해주세요.');
            let { roster, parties } = importData;
            if (node.dataset.importMode === 'add') {
                roster = store.importRoster(store.read('roster'), roster);
                const existing = store.read('parties') || [];
                const content = page => { const p = C.clone(page); delete p.id; for (const t of p.teams) delete t.id; return C.canonical(p); };
                parties = [...existing, ...parties.filter(page => !existing.some(p => content(p) === content(page))).map(page => ({ ...page, id: crypto.randomUUID(), teams: page.teams.map(t => ({ ...t, id: crypto.randomUUID() })) }))];
            }
            store.writeMany({ roster, parties });
            await sync.flush();
            if (sync.state !== 'saved') throw Error('가져온 변경은 이 기기에 보관했습니다. 동기화 상태를 확인해주세요.');
            message('브라우저 기록을 계정으로 가져왔습니다. 원본 기록도 유지했습니다.');
        }
        localStorage.setItem(marker, 'done'); importData = null; q('[data-account-import-options]').hidden = true;
    });
    let settings = window.MORIMENS_FIREBASE;
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('accountEmulator') === '1') {
        settings = { enabled: true, emulators: true, config: { projectId: 'demo-morimens-account', apiKey: 'demo-key', authDomain: 'demo-morimens-account.firebaseapp.com', appId: 'demo-account-app' } };
    }
    render(); button.disabled = true;
    if (!settings?.enabled) {
        host.querySelector('[data-account-status]').textContent = '계정 연결 준비 중 · 비로그인 기록은 이 기기에 저장됩니다.';
        return;
    }
    try {
        driver = await createFirebaseDriver(settings);
        sync = new AccountSync(store, driver, { notify: render });
        q('[data-account-google]').onclick = () => { driver.login().catch(error => message(sync.message(error))); };
        q('[data-account-test]').hidden = !driver.emulator;
        q('[data-account-test]').onsubmit = event => {
            event.preventDefault(); const form = event.currentTarget;
            action(() => driver.loginTest(form.elements.email.value, form.elements.password.value, event.submitter?.value === 'create'));
        };
        driver.observe(async next => {
            user = next; q('[data-account-import-options]').hidden = true; q('[data-account-delete-check]').checked = false;
            const expectedUid = next?.uid;
            await sync.connect(next);
            if (user?.uid !== expectedUid) return;
            q('#account-game-uid').value = sync.profile?.gameUid || '';
            if (next && sync.state === 'saved' && store.hasGuest() && !localStorage.getItem(`morimens_account_import_v1:${next.uid}`)) {
                try { prepareImport(); } catch (error) { message(error.message); }
            }
        });
        window.addEventListener('online', () => { if (sync.state === 'error') sync.refresh(); });
        let peerTimer;
        window.addEventListener('storage', event => {
            if (!store.uid || event.key !== `morimens_account_v1:${store.uid}` || sync.conflict || store.blocked) return;
            clearTimeout(peerTimer);
            peerTimer = setTimeout(() => { if (!sync.conflict && !store.blocked) sync.refresh(); }, 500);
        });
        render();
    } catch { host.querySelector('[data-account-status]').textContent = '로그인 연결을 확인할 수 없습니다. 비로그인으로 계속 사용할 수 있습니다.'; }
}
