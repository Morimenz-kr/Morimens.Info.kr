import {encodeCovenantSetting, decodeCovenantSetting, covenantTransferLimit} from './covenant-transfer.mjs';

let serial = 0;
export function renderCovenantTransfer(parent, {owner, catalog, metadata, onImport}) {
    const tools = document.createElement('div');
    tools.className = 'covenant-transfer-actions';
    const button = text => { const node = document.createElement('button'); node.type = 'button'; node.textContent = text; return node; };
    const copy = button('세팅 복사'), paste = button('세팅 가져오기');
    paste.dataset.covenantImport = '';
    tools.append(copy, paste);
    const dialog = document.createElement('dialog');
    dialog.className = 'covenant-transfer-dialog';
    const heading = document.createElement('h3'), help = document.createElement('p'), input = document.createElement('textarea');
    heading.id = `covenant-transfer-title-${++serial}`;
    dialog.setAttribute('aria-labelledby', heading.id);
    input.setAttribute('aria-label', '비밀계약 세팅');
    input.rows = 6; input.maxLength = covenantTransferLimit; input.spellcheck = false;
    const status = document.createElement('p'); status.className = 'covenant-transfer-status'; status.setAttribute('role', 'status');
    const actions = document.createElement('div'), close = button('닫기'), apply = button('세팅 적용'), select = button('전체 선택');
    actions.className = 'covenant-transfer-actions'; actions.append(close, select, apply);
    dialog.append(heading, help, input, status, actions); parent.append(tools, dialog);
    let trigger = paste;
    const open = exporting => {
        trigger = exporting ? copy : paste;
        heading.textContent = exporting ? '비밀계약 세팅 복사' : '비밀계약 세팅 가져오기';
        help.textContent = exporting ? '이 세팅을 다른 비밀계약 편집기의 ‘세팅 가져오기’에 붙여넣으세요.' : '복사한 세팅을 붙여넣으세요. 현재 6부위의 비밀계약·옵션·귀속만 교체하며 다른 파티 정보는 유지합니다.';
        input.readOnly = exporting; apply.hidden = exporting; select.hidden = !exporting; status.textContent = ''; input.value = '';
        try { if (exporting) input.value = encodeCovenantSetting(owner, catalog, metadata); }
        catch (error) { status.textContent = error.message; }
        dialog.showModal(); input.focus(); if (exporting) input.select();
    };
    copy.onclick = async () => {
        open(true);
        if (!input.value) return;
        try { await navigator.clipboard.writeText(input.value); if (dialog.open) status.textContent = '세팅을 복사했습니다.'; }
        catch { if (dialog.open) status.textContent = '자동 복사가 허용되지 않았습니다. 전체 선택 후 직접 복사하세요.'; }
    };
    paste.onclick = () => open(false);
    select.onclick = () => { input.focus(); input.select(); };
    close.onclick = () => dialog.close();
    // Let the native dialog handle Escape without closing its host's editor too.
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
    dialog.addEventListener('close', () => { if (trigger.isConnected) trigger.focus({preventScroll: true}); });
    apply.onclick = () => {
        try {
            const equipment = decodeCovenantSetting(input.value, catalog, metadata);
            dialog.close(); onImport(equipment);
        } catch (error) { status.textContent = error.message; input.focus(); }
    };
    return tools;
}
