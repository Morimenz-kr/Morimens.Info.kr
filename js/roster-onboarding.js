(function () {
    'use strict';
    const TOUR_KEY = 'morimens-roster-tour-v1';
    const $ = id => document.getElementById(id);
    const seen = key => { try { return localStorage.getItem(key) === 'done'; } catch { return false; } };
    const remember = key => { try { localStorage.setItem(key, 'done'); } catch { /* The guide still works without storage. */ } };
    let step = 0, previousFocus = null, frame = 0;
    const steps = [
        { title:'분류별로 한 번에 선택하세요', text:'상시·한정이나 챕터로 목록을 좁힌 뒤 전체 선택하세요. 없는 각성체만 썸네일을 눌러 해제하면 돼요.', target:'#availability-filter' },
        { title:'수치를 누르면 성장 편집', text:'보유한 각성체의 레벨이나 스킬·특성 수치를 누르면 편집창이 열려요.', target:'.compact-level', example:true },
        { title:'선택한 목록을 한 번에 설정', text:'일괄 편집을 누르면 현재 목록의 보유 각성체를 설정하는 창이 바로 열려요. 프리셋이나 수치를 고른 뒤 적용하세요.', target:'#bulk-toggle' },
        { title:'사용 방법은 언제든 다시 볼 수 있어요', text:'제목 옆 물음표(?) 버튼을 누르면 이 튜토리얼을 처음부터 다시 볼 수 있어요.', target:'#roster-help' }
    ];
    function position() {
        if (!$('roster-tour').open) return;
        const card = $('tour-card'), focus = $('tour-spotlight');
        const target = document.querySelector(steps[step].target) || document.querySelector('.compact-select') || $('search');
        const rect = target.getBoundingClientRect(), margin = 12, gap = 16;
        card.style.maxHeight = '';
        const w = card.offsetWidth, h = card.offsetHeight;
        let left = rect.right + gap, top = Math.max(margin, Math.min(rect.top, innerHeight-h-margin));
        if (left+w > innerWidth-margin) {
            left = Math.max(margin, Math.min(rect.left, innerWidth-w-margin));
            const below = innerHeight-rect.bottom-gap-margin, above = rect.top-gap-margin;
            if (below >= h || below >= above) {
                top = rect.bottom+gap;
                card.style.maxHeight = `${Math.max(64,below)}px`;
            } else {
                card.style.maxHeight = `${Math.max(64,above)}px`;
                top = Math.max(margin,rect.top-card.offsetHeight-gap);
            }
        }
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        focus.style.cssText = `left:${Math.max(4,rect.left-5)}px;top:${Math.max(4,rect.top-5)}px;width:${Math.min(rect.width+10,innerWidth-8)}px;height:${Math.min(rect.height+10,innerHeight-8)}px`;
    }
    function showStep() {
        $('tour-progress').textContent = `${step+1} / ${steps.length}`;
        $('tour-title').textContent = steps[step].title;
        $('tour-description').textContent = steps[step].text;
        $('tour-example').hidden = !steps[step].example;
        $('tour-previous').hidden = step === 0;
        $('tour-next').textContent = step === steps.length-1 ? '완료' : '다음';
        const target = document.querySelector(steps[step].target) || document.querySelector('.compact-select') || $('search');
        const y = target.getBoundingClientRect().top + scrollY;
        window.scrollTo({ top:Math.max(0,y-24), behavior:'instant' });
        $('tour-card').scrollTop = 0;
        position();
        $('tour-next').focus({ preventScroll:true });
    }
    function start() {
        if ($('roster-tour').open) return;
        previousFocus = document.activeElement;
        if (document.querySelector('[data-tab="characters"]').getAttribute('aria-current') !== 'page') {
            document.querySelector('[data-tab="characters"]').click();
        }
        step = 0;
        $('roster-tour').showModal();
        showStep();
    }
    function finish() { remember(TOUR_KEY); $('roster-tour').close(); }
    $('roster-help').onclick = start;
    $('tour-skip').onclick = finish;
    $('tour-next').onclick = () => { if (step === steps.length-1) finish(); else { step++; showStep(); } };
    $('tour-previous').onclick = () => { step--; showStep(); };
    $('roster-tour').addEventListener('cancel', event => { event.preventDefault(); finish(); });
    $('roster-tour').addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const buttons = [...$('tour-card').querySelectorAll('button')].filter(button => !button.hidden && !button.disabled);
        const first = buttons[0], last = buttons[buttons.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    $('roster-tour').addEventListener('close', () => {
        (previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : $('roster-help')).focus({ preventScroll:true });
    });
    window.addEventListener('resize', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); });
    window.addEventListener('scroll', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); }, { passive:true });
    window.addEventListener('roster-ready', () => { if (!seen(TOUR_KEY)) start(); });
    if (document.body.dataset.rosterReady === 'true' && !seen(TOUR_KEY)) start();
})();
