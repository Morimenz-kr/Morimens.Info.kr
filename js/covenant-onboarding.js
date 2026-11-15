(function () {
    'use strict';
    const key = 'morimens-covenant-tour-v1';
    const $ = id => document.getElementById('covenant-' + id);
    const steps = [
        { title:'세 탭의 세팅은 따로 보관돼요', text:'세팅·프리셋, 전사, 목표 시뮬레이션은 각각 독립적이에요. 한 탭에서 수정하거나 초기화해도 다른 탭의 값은 바뀌지 않아요.', target:'.tab-buttons' },
        { mode:'editor', title:'비밀계약과 옵션을 맞춰 보세요', text:'이 버튼으로 비밀계약을 선택·변경하세요. 그림의 부위를 누르면 주옵션·강화·부옵션을 편집할 수 있어요. 귀속을 켜면 능력치에도 반영돼요.', target:'#shared-covenant-editor .member-contract-actions .member-set-change' },
        { mode:'editor', title:'다시 쓸 비밀계약 세팅은 저장하세요', text:'이름을 적고 프리셋 저장을 누르세요. 저장된 항목을 선택한 채 다시 저장하면 덮어써요. 새로 저장하려면 목록을 ‘프리셋 선택’으로 돌려주세요.', target:'#save-preset-btn' },
        { mode:'manual', title:'저장한 비밀계약 세팅 불러오기', text:'‘비밀계약 세팅 불러오기’에서 저장한 세팅을 고르세요. 전사 탭에 복사해 가져오므로 원본은 바뀌지 않아요. 세팅 편집으로 직접 맞출 수도 있어요.', target:'#manual-panel .simulator-preset-import' },
        { mode:'manual', title:'남길 옵션을 잠그고 전사', text:'그림에서 부위를 고르고 유지할 부옵션의 잠금 아이콘을 누르세요. 최대 두 개까지 잠글 수 있어요. 전사를 누르면 새 옵션과 소모 비용을 확인할 수 있어요.', target:'#manual-reroll-btn' },
        { mode:'manual', title:'잔본·깃펜은 가운데 스위치로', text:'가운데 스위치를 누를 때마다 잠금 비용의 잔본·깃펜 우선순위가 바뀌어요. 전사와 목표 시뮬레이션의 선택은 각각 따로 기억해요.', target:'#manual-panel .resource-priority' },
        { mode:'manual', title:'결과가 마음에 들면 교체', text:'전사만으로 현재 옵션이 바뀌지는 않아요. 결과를 확인한 뒤 교체를 누르세요. 교체 전 결과도 새로고침 후 이어서 볼 수 있어요.', target:'#manual-apply-btn' },
        { mode:'target', view:'goals', title:'목표 옵션도 아이콘으로 고르세요', text:'‘현재’는 시작 옵션, ‘목표’는 원하는 부옵션과 최소 레벨이에요. 아이콘을 눌러 옵션을 고르고 최소 레벨을 정하세요. 이 탭에도 상단에서 비밀계약 세팅을 따로 불러올 수 있어요.', target:'[data-target-part]:not([hidden]) [data-goal-index="0"] .target-option-icons' },
        { mode:'target', title:'목표까지의 횟수와 비용 확인', text:'그림의 부위 번호로 계산 대상을 고른 뒤 시뮬레이션을 누르세요. 결과 영역에서 전사 횟수와 소모량을 확인할 수 있어요. 비용 우선순위는 여기서도 잔본·깃펜 스위치로 바꿔요.', target:'#run-target-btn' },
        { title:'세팅과 목표 조건은 자동 저장돼요', text:'현재 세팅과 목표 조건은 이 브라우저에 자동 저장돼요. 저장·불러오기 완료는 잠깐 뜨는 토스트로 알려줘요. 브라우저 데이터를 지우면 사라지며 다른 기기와는 연동되지 않아요. ?에서 이 안내를 다시 볼 수 있어요.', target:'#covenant-help' }
    ];
    let step = 0, previousFocus, originalMode, originalTargetView, originalScroll, originalScrollContainers, frame;
    const dialog = $('tour'), card = $('tour-card');
    function stepTarget() {
        const target = document.querySelector(steps[step].target);
        return target?.getClientRects().length ? target : $('help');
    }
    function position() {
        if (!dialog.open) return;
        const target = stepTarget();
        const cardScroll = card.scrollTop;
        const r = target.getBoundingClientRect(), gap = 12, margin = 12;
        card.style.maxHeight = (innerHeight - margin * 2) + 'px';
        const w = card.offsetWidth, h = card.offsetHeight;
        let left = r.right + gap, top;
        if (left + w <= innerWidth - margin) top = Math.max(margin, Math.min(r.top, innerHeight - h - margin));
        else {
            left = Math.max(margin, Math.min(r.left, innerWidth - w - margin));
            const below = innerHeight - Math.min(innerHeight, r.bottom) - gap - margin;
            const above = Math.max(0, r.top - gap - margin);
            if (below >= above) {
                card.style.maxHeight = Math.max(64, below) + 'px';
                top = Math.min(innerHeight - card.offsetHeight - margin, r.bottom + gap);
            } else {
                card.style.maxHeight = Math.max(64, above) + 'px';
                top = Math.max(margin, r.top - gap - card.offsetHeight);
            }
        }
        card.style.left = left + 'px'; card.style.top = Math.max(margin, top) + 'px';
        card.scrollTop = cardScroll;
        const x = Math.max(4, r.left - 4), y = Math.max(4, r.top - 4);
        $('tour-spotlight').style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, Math.min(innerWidth-4,r.right+4)-x)}px;height:${Math.max(0,Math.min(innerHeight-4,r.bottom+4)-y)}px`;
    }
    function showStep() {
        const s = steps[step];
        if (s.mode) document.querySelector(`[data-mode-tab="${s.mode}"]`).click();
        if (s.view) document.querySelector(`[data-target-editor-view="${s.view}"]`).click();
        $('tour-progress').textContent = `${step + 1} / ${steps.length}`;
        $('tour-title').textContent = s.title; $('tour-description').textContent = s.text;
        $('tour-previous').hidden = step === 0;
        $('tour-next').textContent = step === steps.length - 1 ? '완료' : '다음';
        dialog.dataset.target = s.target;
        const target = stepTarget();
        target?.scrollIntoView({block:'start', behavior:'instant'});
        window.scrollBy({top:-24, behavior:'instant'});
        card.scrollTop = 0; position(); $('tour-next').focus({preventScroll:true});
    }
    function start() {
        if (dialog.open || $('help').disabled) return;
        previousFocus = document.activeElement;
        originalMode = document.querySelector('[data-mode-tab][aria-selected="true"]').dataset.modeTab;
        originalTargetView = document.querySelector('[data-target-editor-view][aria-selected="true"]').dataset.targetEditorView;
        originalScroll = {left:scrollX, top:scrollY};
        originalScrollContainers = [...document.querySelectorAll('.target-controls-scroll,.transcription-detail-scroll')].map(el=>({el,top:el.scrollTop,left:el.scrollLeft}));
        document.documentElement.classList.add('covenant-tour-open');
        step = 0; dialog.showModal(); showStep();
    }
    function finish() {
        try { localStorage.setItem(key, 'done'); } catch { /* Guide remains usable. */ }
        dialog.close();
    }
    $('help').onclick = start;
    $('tour-skip').onclick = finish;
    $('tour-next').onclick = () => { if (step === steps.length - 1) finish(); else { step++; showStep(); } };
    $('tour-previous').onclick = () => { step--; showStep(); };
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(); });
    dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('covenant-tour-open');
        if (document.querySelector('[data-target-editor-view][aria-selected="true"]').dataset.targetEditorView !== originalTargetView) document.querySelector(`[data-target-editor-view="${originalTargetView}"]`).click();
        document.querySelector(`[data-mode-tab="${originalMode}"]`).click();
        for (const {el,top,left} of originalScrollContainers) if (el.isConnected) el.scrollTo({top,left,behavior:'instant'});
        window.scrollTo({...originalScroll, behavior:'instant'});
        (previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : $('help')).focus({preventScroll:true});
    });
    dialog.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const buttons = [...card.querySelectorAll('button')].filter(b => !b.hidden);
        if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === buttons.at(-1)) { e.preventDefault(); buttons[0].focus(); }
    });
    const schedule = event => {
        if (event?.type === 'scroll' && event.target instanceof Node && card.contains(event.target)) return;
        cancelAnimationFrame(frame); frame = requestAnimationFrame(position);
    };
    for (const type of ['wheel','touchmove']) dialog.addEventListener(type, event => {
        if (event.ctrlKey || event.metaKey || event.touches?.length > 1) return;
        if (!card.contains(event.target)) event.preventDefault();
    }, {passive:false});
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, {capture:true, passive:true});
    document.addEventListener('covenant-ready', () => {
        let seen = false; try { seen = localStorage.getItem(key) === 'done'; } catch { /* First visit. */ }
        if (!seen) start();
    });
})();
