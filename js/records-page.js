(async function () {
    'use strict';
    const $ = id => document.getElementById(id), F = RecordFeatures, I = RecordIntegration;
    const api = RecordFeatureClient.create({ baseUrl: ['127.0.0.1','localhost'].includes(location.hostname) ? '' : CONFIG.RECORD_QUERY_ENDPOINT_URL });
    const catalog = RecordCatalogClient.create({ baseUrl: new URL('.', location.href).href });
    const content = $('record-content'), status = $('record-status');
    let links, manifest, currentReview, currentParty, controller, generation = 0;
    const portraits = {}, blobs = new Set();
    const recent = F.recentProfiles(localStorage);
    const text = value => value === null || value === undefined ? '미확인' : String(value);
    const number = value => Number.isFinite(value) ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value) : '미확인';
    const time = value => Number.isFinite(value) && value > 0 ? new Date(value * 1000).toLocaleString('ko-KR') : '미확인';
    const node = (tag, value, className) => { const el = document.createElement(tag); if (value !== undefined) el.textContent = text(value); if (className) el.className = className; return el; };
    const heading = value => content.append(node('h2', value));
    const note = (parent, value) => parent.append(node('p', value, 'records-note'));
    const panel = (parent, title) => { const el = node('section', undefined, 'records-panel'); if (title) el.append(node('h3', title)); parent.append(el); return el; };
    const button = (parent, title, action) => { const el = node('button', title); el.type = 'button'; el.addEventListener('click', action); parent.append(el); return el; };
    const link = (parent, title, url) => { const el = node('a', title); el.href = url; parent.append(el); return el; };
    const routeLink = (parent, title, view, values) => link(parent, title, I.shareUrl(location.href, view, values));
    const image = (parent, src, alt, className = 'records-small-image') => {
        if (!src) return;
        const url = new URL(src, location.href); if (url.origin !== location.origin || !/\/images\//.test(url.pathname)) return;
        const img = node('img', undefined, className); img.src = url.href; img.alt = alt; img.width = 48; img.height = 48; img.loading = 'lazy'; parent.append(img);
    };
    function field(parent, title, value = '', type = 'text') {
        const label = node('label', title), input = node('input'); input.type = type; input.value = value; input.setAttribute('aria-label', title); label.append(input); parent.append(label); return input;
    }
    function check(parent, title, selected = false) {
        const label = node('label', undefined, 'records-check'), input = node('input'); input.type = 'checkbox'; input.checked = selected;
        label.append(input, document.createTextNode(title)); parent.append(label); return input;
    }
    function select(parent, title, rows, value = '') {
        const label = node('label', title), input = node('select'); input.setAttribute('aria-label', title); for (const [key, name] of rows) input.add(new Option(name, key));
        input.value = String(value); label.append(input); parent.append(label); return input;
    }
    function disclosure(parent, title, values) {
        const details = node('details'), summary = node('summary', title); details.append(summary, node('pre', JSON.stringify(values, null, 2))); parent.append(details); return details;
    }
    function stats(parent, values) {
        const list = node('dl', undefined, 'records-stats'); for (const [name, value] of values) {
            const item = node('div'); item.append(node('dt', name), node('dd', value)); list.append(item);
        } parent.append(list);
    }
    function table(parent, headers, rows) {
        const wrap = node('div', undefined, 'records-table-scroll'), el = node('table'), head = node('thead'), hr = node('tr');
        for (const label of headers) { const th = node('th', label); th.scope = 'col'; hr.append(th); } head.append(hr); el.append(head);
        const body = node('tbody'); for (const row of rows) { const tr = node('tr'); for (const value of row) { const td = node('td'); value instanceof Node ? td.append(value) : td.textContent = text(value); tr.append(td); } body.append(tr); }
        el.append(body); wrap.append(el); parent.append(wrap); return wrap;
    }
    function charName(tid) { if(String(tid)==='1')return '비밀수호자·공용 효과';const id = links.characters.find(row => String(row.clientId) === String(tid))?.siteId; return manifest.find(row => row.id === id)?.name ?? String(tid); }
    function clearCard(parent, row) {
        const mode=row.mode??row.challengeStage?.mode,alert=row.alert??row.challengeStage?.alert,box = panel(parent, `${row.stageName ?? row.stageTid ?? '스테이지'} · ${({dzone:'융재금구',pdive:'환몽심잠',railway:'열차'})[mode]??'일반 기록'}`);
        note(box, `${time(row.timestamp)} · ${row.summary?.stageRoundCount ?? row.totalBout ?? row.turns ?? '?'}턴 · 시즌 ${row.season ?? row.challengeStage?.season ?? '?'} · ${row.slot ?? row.challengeStage?.slot ?? '?'}파 · ${['C','B','A','S','SS','SSS'][alert-1]??'난이도 미확인'}`);
        note(box,`기록 점수 ${number(row.score)} · 랭킹 인정 여부 ${row.rankingEligibilityVerified===true?'확인':'미검증'}`);
        note(box, (row.awakeners ?? []).map(aw => `${aw.name ?? charName(aw.tid)} (계령 ${aw.potencyLevel ?? '?'})${aw.assistPlayerId > 0 ? ' · 지원' : ''}`).join(' / '));
        routeLink(box, '빌드·전투 분석 보기', 'review', { code: row.battleUuid });
        if (row.playerId) routeLink(box, ' 플레이어 보기', 'profile', { uid: row.playerId });
    }
    async function run(action, { clear = true } = {}) {
        controller?.abort(); controller = new AbortController(); const ticket = ++generation;
        status.className = ''; status.textContent = '자료를 불러오는 중…'; content.setAttribute('aria-busy', 'true');
        if (clear) content.replaceChildren();
        try { await action({ signal: controller.signal }); if (ticket === generation) status.textContent = '조회 완료'; }
        catch (error) { if (error.name !== 'AbortError' && ticket === generation) { status.className = 'records-error'; status.textContent = error.message; } }
        finally { if (ticket === generation) content.removeAttribute('aria-busy'); }
    }
    async function copy(value) { try { await navigator.clipboard.writeText(value); status.textContent = '클립보드에 복사했습니다.'; } catch { status.textContent = '클립보드를 사용할 수 없습니다. 아래 텍스트를 직접 복사해 주세요.'; const input = field(content, '복사할 텍스트', value); input.select(); } }
    function recentList() {
        $('recent-profiles').replaceChildren(); for (const row of recent.list()) {
            const box = node('div', undefined, 'records-actions'); routeLink(box, `${row.name} · ${row.uid}`, 'profile', { uid: row.uid });
            button(box, `${row.name} 최근 조회 삭제`, () => { recent.remove(row.uid); recentList(); }); $('recent-profiles').append(box);
        } if (!recent.list().length) note($('recent-profiles'), '최근 조회가 없습니다.');
    }
    async function profile(uid, options) {
        const response = await api.profile(uid, options), data = response.data; heading(data.name ?? uid);
        const box = panel(content, '공개 프로필'); image(box, data.avatar?.image, data.avatar?.name ?? '아바타'); image(box, data.frame?.image, data.frame?.name ?? '테두리');
        stats(box, [['UID', data.uid], ['계정 레벨', data.level], ['수집 수', data.collectionCount], ['좋아요', data.goodNum], ['팔로워',data.followerNum], ['팔로잉',data.attentionNum], ['방문',data.visiterNum], ['지원 횟수',data.AssistNum]]); note(box, data.note ?? '');
        recent.add({ uid: data.uid ?? uid, name: data.name ?? uid }); recentList();
        if (data.career) { stats(box, Object.entries(data.career.statistics).map(([key, value]) => [({ awakeners: '각성체 보유 수', achievements: '업적 수', loginDays: '접속일', assists: '지원 횟수', likesGiven: '준 좋아요', collection: '수집 수' })[key] ?? key, number(value)])); disclosure(box, '스토리 진행·생애 최고 기록', data.career); }
        const actions = node('div', undefined, 'records-actions'); box.append(actions);
        for (const [title, kind] of [['도전 기록', 'challenges'], ['최근 스테이지', 'history'], ['PvP 경기', 'matches']]) button(actions, title, () => run(opts => profileRecords(uid, kind, 1, opts)));
        button(actions, '최신 융재금구 클리어', () => run(async opts => { const r = await api.latestDzone(uid, opts); heading('최신 융재금구 클리어'); const record = r.data.record ?? r.data.latest?.record ?? r.data.latest ?? r.data; if (record?.battleUuid) clearCard(content, record); else note(content, '조회 가능한 범위에 기록이 없습니다.'); }));
        const grid = node('div', undefined, 'records-grid records-party'); content.append(grid);
        const displayed = [...(data.showcase ?? [])]; if(data.assist?.tid&&!displayed.some(member=>member.tid===data.assist.tid))displayed.push(data.assist);
        for (const aw of displayed) { const card = panel(grid, aw.name ?? charName(aw.tid)); image(card, aw.image_thumb, aw.name ?? '', ''); note(card, `Lv.${aw.level ?? '?'} · 계령 ${aw.potencyLevel ?? '?'}`); if(data.assist?.tid===aw.tid)note(card,'지원 각성체');
            button(card, '현재 전시 빌드 상세', () => run(async opts => { const r = await api.showcase(uid, aw.tid, opts); heading('현재 전시 빌드 — 클리어 당시 빌드와 다름'); renderBuild(r.data.details); })); }
    }
    async function profileRecords(uid, kind, page, options) {
        const r = kind === 'challenges' ? await api.challenges(uid, options) : await api[kind](uid, page, options); heading(({ challenges: '시즌별 도전 기록', history: '최근 스테이지 기록', matches: 'PvP 경기' })[kind]);
        routeLink(content, '프로필로 돌아가기', 'profile', { uid });
        if (kind === 'matches') {
            note(content, `${r.data.summary.wins}승 ${r.data.summary.losses}패 · 조회한 페이지 기준, 누적 승률이 아닙니다.`);
            for (const match of r.data.matches) {
                const box = panel(content, `${time(match.timestamp)} · ${match.outcome === 'win' ? '승리' : match.outcome === 'loss' ? '패배' : '미확정'}`);
                const grid = node('div', undefined, 'records-grid'); box.append(grid);
                for (const player of [match.self, match.opponent]) { const side = panel(grid, `${player.name ?? player.uid}${player.isAI ? ' · AI' : ''}`);
                    note(side, player.awakeners.map(aw => aw.name ?? charName(aw.tid)).join(' / ')); stats(side, [['피해', number(player.totals.damage)], ['회복', number(player.totals.heal)], ['방어막', number(player.totals.shield)]]);
                    disclosure(side, '장비·은열쇠·개별 기여 수치', player); }
                button(box, '리플레이 코드 복사', () => copy(match.battleUuid)); }
        } else {
            const rows = kind === 'challenges' ? r.data.bestBySeasonSlot?.records ?? r.data.records ?? [] : r.data.records ?? [];
            const filters = node('div', undefined, 'records-actions'); content.append(filters);
            const modes = select(filters, '모드', [['', '전체'], ['dzone', '융재금구'], ['pdive', '환몽심잠'], ['railway', '열차']]);
            const season = select(filters, '시즌', [['', '전체'], ...[...new Set(rows.map(row => row.season??row.challengeStage?.season).filter(Boolean))].sort((a,b) => b-a).map(n => [n, `시즌 ${n}`])]);
            const results = node('div'); content.append(results); const update = () => { results.replaceChildren(); const matched = rows.filter(row => (!modes.value || (row.mode??row.challengeStage?.mode) === modes.value) && (!season.value || String(row.season??row.challengeStage?.season) === season.value)); if (!matched.length) note(results, '이 공개 조회 범위에 기록이 없습니다.'); matched.forEach(row => clearCard(results, row)); };
            modes.addEventListener('change', update); season.addEventListener('change', update); update();
        }
        if (r.data.totalPage > page) button(content, '다음 페이지', () => run(opts => profileRecords(uid, kind, page + 1, opts)));
    }
    function renderBuild(build) {
        const box = panel(content, build.name ?? charName(build.tid));
        const rows = build.stats ?? [], scope = select(box, '수치 범위', [['basePlusGear', '기록 기본값 + 장비 명시 옵션'], ['gear', '장비 기여분만']], 'basePlusGear');
        const values = node('div'); box.append(values); const draw = () => { values.replaceChildren(); stats(values, rows.map(row => [row.name ?? row.key, `${number(row[scope.value])}${row.percentage ? '%' : ''}`])); }; scope.addEventListener('change', draw); draw();
        note(box, '이 합산값은 전투 상태·조건부 효과를 포함한 최종 스탯과 다릅니다.');
        if (build.covenantCompletion) note(box, `비밀계약 완성도 ${number(build.covenantCompletion.percentage)}% · 원본 클라이언트 공식, Eremora 평가와의 일치 검증은 별도`);
        disclosure(box, '기본값·장비 기여·확인 범위', build);
        for (const card of build.cards ?? []) { const details = node('details'); details.append(node('summary', `${card.name ?? card.tid} · Lv.${card.level ?? card.skillLevel ?? '?'} · 기본 비용 ${card.baseCost ?? card.cost ?? '?'} · 강화 ${card.upNum ?? '?'}`), node('p', card.resolvedDescription ?? card.description ?? card.descriptionTemplate ?? '원문 미확인')); if (card.valuesResolved === false) note(details, '전투 상태 등 필요한 입력이 없어 일부 값은 미확정입니다.'); box.append(details); }
        for (const talent of build.talents ?? []) { const details = node('details'); details.append(node('summary', `${talent.name ?? talent.tid} · Lv.${talent.level ?? '?'}`), node('p', talent.resolvedDescription)); box.append(details); }
        for (const set of build.covenants?.sets ?? []) { const details = node('details'); details.append(node('summary', `${set.name} ${set.count}피스`)); for (const effect of set.activeEffects) note(details, effect.description); box.append(details); }
    }
    async function review(code, options) {
        const response = await api.review(code, options); currentReview = response.data; currentParty = F.partyFromReview(currentReview);
        history.replaceState(null, '', I.shareUrl(location.href, 'review', { code })); await renderReview(false);
    }
    async function renderReview(demo) {
        heading(demo ? '데모 전투 — 가상의 예시이며 실제 클리어가 아닙니다' : '클리어 당시 파티 빌드');
        note(content, demo ? '아래 숫자와 장비는 기능 설명용입니다. 실제 계정·서버 기록이 아닙니다.' : `${time(currentReview.timestamp)} · 스테이지 ${currentReview.stageTid}`);
        stats(content, [['계정 레벨', currentParty.keeperLevel], ['전체 턴', currentReview.summary?.stageRoundCount], ['최종전 턴', currentReview.summary?.bossBattleRoundCount], ['죽음 저항 발동', currentReview.summary?.deathResistCount], ['응급 영지체', currentReview.summary?.respawnedNum]]);
        const actions = node('div', undefined, 'records-actions'); content.append(actions);
        button(actions, '빌드 JSON 저장', () => RecordBuildShare.download(new Blob([JSON.stringify(currentParty, null, 2)], { type: 'application/json' }), 'morimens-build.json'));
        if (!demo) {
            button(actions, '기록 링크 복사', () => copy(location.href)); button(actions, '리플레이 코드 복사', () => copy(currentReview.battleUuid));
            button(actions, '내 편성으로 가져오기', () => run(async opts => { const r = await api.partyCode(currentReview.battleUuid, opts); if (!r.data.complete) throw Error('미매핑 항목이 있어 가져올 수 없습니다. 빌드 JSON에서 확인해 주세요.'); location.href = I.stageHandoff(sessionStorage, r.data.party, links); }, { clear: false }));
            button(actions, 'ScareCrow로 가져오기', () => run(async opts => { const r = await api.simulation(currentReview.battleUuid, opts); location.href = I.simulationUrl(CONFIG.SCARECROW_ENDPOINT_URL, r.data); }, { clear: false }));
            button(actions, 'ScareCrow 가져오기 파일 저장', () => run(async opts => { const r = await api.simulation(currentReview.battleUuid, opts); RecordBuildShare.download(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }), 'scarecrow-record-build.json'); }, { clear: false }));
        }
        const share = panel(content, '빌드 이미지 공유'), privacy = check(share, '이름·UID 숨김', true);
        note(share, '개인정보는 기본적으로 숨깁니다. 사용자 이미지는 이 브라우저에서만 처리하며 서버로 업로드하지 않습니다.');
        button(share, 'PNG 이미지 저장', async () => { try { status.textContent = '이미지를 만드는 중…'; const result = await RecordBuildShare.render(currentParty, { hideIdentity: privacy.checked, identity: { uid: currentReview.playerId }, portraits }); RecordBuildShare.download(result.blob, 'morimens-party-build.png'); status.textContent = '이미지를 저장했습니다.'; } catch(error) { status.textContent = error.message; } });
        const grid = node('div', undefined, 'records-grid records-party'); content.append(grid);
        for (const [index, member] of currentParty.members.entries()) {
            const card = panel(grid, member.name ?? charName(member.tid)); card.classList.add('records-member'); image(card, member.image, member.name ?? '', '');
            note(card, `Lv.${member.level} · 계령 ${member.potencyLevel}`); note(card, '개별 카드 레벨 ' + member.cards.map(row => row.level ?? '?').join(' / '));
            for (const [i, wheel] of member.wheels.entries()) note(card, `명륜 ${i+1}: ${wheel.item?.name ?? '없음'} · 돌파 ${wheel.item?.enhanceLevel ?? '?'} · 강화 Lv.${wheel.item?.level ?? '?'}`);
            note(card, `비밀계약 ${member.covenants.filter(Boolean).length}부위 · 결속 정보 ${member.boundTrinketsComplete ? '확인' : '미확정'}`);
            const siteId = links.characters.find(row => row.clientId === member.tid)?.siteId;
            if (siteId) link(card, '각성체 도감', `detail.html?id=${encodeURIComponent(siteId)}`);
            if (!demo) {
                button(card, '성장·카드·장비 상세', () => run(async opts => renderBuild((await api.build(currentReview.battleUuid, member.tid, opts)).data), { clear: false }));
                button(card, '원본 빌드 계산·스탯 확인', () => run(async opts => { const r = await api.originalBuild(currentReview.battleUuid, member.tid, {}, opts); const box = panel(content, `${member.name} 원본 빌드 계산`); stats(box, r.data.displayStats.map(row => [row.name, `${number(row.value)}${row.percentage ? '%' : ''}`])); note(box, '전투 상태·패시브 활성화 이전 값입니다. 조건부 최종값과 다릅니다.'); disclosure(box, '계산 근거와 미치환 카드 값', r.data); }, { clear: false }));
                const context=node('details');context.append(node('summary','명시적 상태 중첩으로 카드 수치 확인'));card.append(context);note(context,'저장된 특정 턴을 복원하는 기능이 아닙니다. 원본 상태 ID와 중첩 수를 입력한 가정입니다. 미입력 조건을 0으로 가정하지 않습니다.');
                const actorLayers=field(context,'각성체 상태 중첩 JSON','{}'),playerLayers=field(context,'파티 상태 중첩 JSON','{}');
                button(context,'입력 조건으로 카드 설명 계산',()=>run(async opts=>{const read=input=>{const value=JSON.parse(input.value);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>100)throw Error('상태 ID: 중첩 수 형태의 JSON 객체를 입력해 주세요.');return value;};const r=await api.originalBuild(currentReview.battleUuid,member.tid,{actorLayers:read(actorLayers),playerLayers:read(playerLayers)},opts);const box=panel(content,`${member.name} · 사용자 입력 조건`);for(const value of r.data.cards??[]){const details=node('details');details.append(node('summary',`${value.name} · Lv.${value.level??'?'}`),node('p',value.resolvedDescription??value.descriptionTemplate??'미확정'));if(value.valuesResolved===false)note(details,'입력하지 않은 조건이 남아 일부 값은 미확정입니다.');box.append(details);}disclosure(box,'입력값·계산 범위',r.data.providedLayers);},{clear:false}));
            }
            const crop = node('details'); crop.append(node('summary', '공유 이미지 초상화 조정')); card.append(crop);
            const cropFrame = node('div', undefined, 'records-crop-preview'), cropCanvas = node('canvas'); cropCanvas.setAttribute('role','img');cropCanvas.setAttribute('aria-label',`${member.name} 공유 이미지 미리보기`);cropCanvas.width=200;cropCanvas.height=240;cropFrame.append(cropCanvas);crop.append(cropFrame);const cropImage=new Image();
            const paintCrop=()=>{const ctx=cropCanvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,200,240);if(cropImage.complete&&cropImage.naturalWidth)RecordBuildShare.drawPortrait(ctx,cropImage,0,0,200,240,portraits[index]);};cropImage.onload=paintCrop;
            const previewCrop = () => { const value = portraits[index] ?? {}, src=value.src ?? member.image;cropFrame.hidden=!src;if(!src)return;const url=new URL(src,location.href);if(url.origin!==location.origin&&url.protocol!=='blob:')return;if(cropImage.src!==url.href)cropImage.src=url.href;else paintCrop(); }; previewCrop();
            const file = field(crop, '내 이미지 선택', '', 'file'); file.accept = 'image/png,image/jpeg,image/webp';
            file.addEventListener('change', () => { const selected = file.files[0]; if (!selected) return; if (selected.size > 10000000 || !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)) { status.textContent = '10MB 이하의 PNG/JPEG/WebP 이미지만 선택해 주세요.'; return; }
                if (portraits[index]?.src?.startsWith('blob:')) URL.revokeObjectURL(portraits[index].src);
                const url = URL.createObjectURL(selected); blobs.add(url); portraits[index] = { ...portraits[index], src: url }; previewCrop(); });
            for (const [key, title, min, max] of [['zoom', '확대', 1, 3], ['x', '가로 위치', -1, 1], ['y', '세로 위치', -1, 1]]) { const input = field(crop, title, key === 'zoom' ? '1' : '0', 'range'); input.min = min; input.max = max; input.step = .05; input.addEventListener('input', () => { portraits[index] = { ...portraits[index], [key]: Number(input.value) }; previewCrop(); }); }
            button(crop, '초상화 초기화', () => { if (portraits[index]?.src?.startsWith('blob:')) URL.revokeObjectURL(portraits[index].src); delete portraits[index]; for (const input of crop.querySelectorAll('input[type=range]')) input.value = input.min === '1' ? '1' : '0'; file.value = ''; previewCrop(); });
        }
        if (currentReview.teamAttrs) stats(content, [['영역 숙련', number(currentReview.teamAttrs.occupation_master_final)], ['피해 증폭', number(currentReview.teamAttrs.basic_damage_per)], ['검은 인장 드롭율', number(currentReview.teamAttrs.blackcoin_upgrade_per)], ['죽음 저항', number(currentReview.teamAttrs.death_resist)]]);
        disclosure(content, '획득 유물·추가 전투 요약', { relics: currentReview.relics, summary: currentReview.summary });
        if (currentReview.silverkey?.name) { const key = panel(content, '은열쇠'); image(key, currentReview.silverkey.image, currentReview.silverkey.name); note(key, currentReview.silverkey.name); link(key, '은열쇠 도감', 'links.html?category=silverkey'); }
        for (const relic of currentReview.relics ?? []) { const box = panel(content, `${relic.name} · ID ${relic.tid}`); image(box, relic.image, relic.name); note(box, relic.tierLabel ?? ''); button(box, '기록 유물의 정확한 변형 설명', () => run(async opts => { const r = await catalog.relic(relic.tid, { level: currentParty.keeperLevel }, opts); note(box, r.data.variant.description); if (!r.data.variant.resolved) note(box, '전투 문맥이 필요한 값은 미확정입니다.'); }, { clear: false })); }
        const analysisBox = panel(content, '전투 분석'), controls = node('div', undefined, 'records-actions'); analysisBox.append(controls);
        const metric = select(controls, '지표', [['damage','피해'],['healing','회복'],['shield','방어막']], 'damage');
        const actorIds=[...new Set([...currentParty.members.map(row=>String(row.tid)),...Object.values(currentReview.totals??{}).flatMap(values=>Object.keys(values))])];const actor = select(controls, '각성체', [['','전체'], ...actorIds.map(tid => [tid,charName(tid)])]);
        const battle = select(controls, '전투 범위', [['','전체'], ...(currentReview.battles ?? []).map((row,i) => [i, `전투 ${i+1} · ${row.gearType ?? '종류 미확인'}`])]);
        const sort = select(controls, '원천 정렬', [['total','합계'],['peak','최대 턴 출력'],['activeTurns','활성 턴 수']], 'total');
        const presentation = select(controls, '기여표 보기', [['all','각성체와 원천'],['actors','각성체'],['sources','카드·상태 원천']]);
        const results = node('div'); analysisBox.append(results); let selectedTurn;
        const draw = () => { try { results.replaceChildren(); const data = F.analyze(currentReview, { metric: metric.value, actor: actor.value || undefined, battle: battle.value === '' ? undefined : Number(battle.value), sourceSort: sort.value, turn: selectedTurn });
            note(results, `합계 ${number(data.total)} · 직접/상태 발동 분류는 모든 트리거 원인의 재구성이 아닙니다.`);
            const actorTable=table(results, ['각성체','기여량','점유율'], [...data.actors].sort((a,b)=>b.value-a.value).map(row => [charName(row.tid), number(row.value), number(row.share * 100) + '%']));actorTable.hidden=presentation.value==='sources';
            const timeline = node('div', undefined, 'records-timeline'); results.append(timeline);
            const peak=Math.max(1,...data.turns.map(row=>row.total));data.turns.forEach(row => { const el = button(timeline, `${row.globalTurn}턴 · ${number(row.total)}`, () => { selectedTurn = row.globalTurn; draw(); }); el.setAttribute('aria-label',`${row.globalTurn}턴 · ${number(row.total)}`);el.setAttribute('aria-pressed', String(selectedTurn === row.globalTurn));const bar=node('meter');bar.min=0;bar.max=peak;bar.value=row.total;bar.setAttribute('aria-label',`${row.globalTurn}턴 기여량 ${number(row.total)}`);el.append(bar); });
            if (data.selectedTurn) { const box = panel(results, `${data.selectedTurn.globalTurn}턴 상세`); table(box, ['각성체','기여량'], data.selectedTurn.actors.map(row => [charName(row.tid), number(row.value)]));
                for (const [label, turn] of [['이전 턴',data.selectedTurn.previous],['다음 턴',data.selectedTurn.next]]) { const el = button(box, label, () => { selectedTurn = turn; draw(); }); el.disabled = turn === null; } button(box, '턴 선택 해제', () => { selectedTurn = undefined; draw(); }); }
            const sourceTable=table(results, ['원천','분류','합계','최대 턴','활성 턴'], data.sources.map(row => { const label = node('span', row.label ?? `${row.kind} ${row.sourceId}`);
                if (!demo && ['skill','state'].includes(row.kind)) button(label, '원문', () => run(async opts => { const r = await api.battleSource(row.kind === 'skill' ? 'Skill' : 'State', row.sourceId, opts); disclosure(results, r.data.name ?? row.sourceId, r.data); }, { clear: false }));
                return [label, row.classification === 'direct' ? '직접' : row.classification === 'proc' ? '상태 발동' : '미확정', number(row.total), number(row.peak), row.activeTurns]; }));sourceTable.hidden=presentation.value==='actors';note(results,'비밀수호자·공용 효과는 기록의 시전자 ID 1에 귀속된 출력입니다. 모든 효과의 실제 원인이나 파티원별 재귀속을 뜻하지 않습니다.');
        } catch(error) { note(results, error.message); } };
        for (const input of [metric,actor,battle,sort,presentation]) input.addEventListener('change', () => { selectedTurn = undefined; draw(); }); draw();
    }
    function filtersForm(initial, submit) {
        const form = node('form', undefined, 'records-panel'), inputs = node('div', undefined, 'records-actions'); form.append(inputs); content.append(form);
        const include = select(inputs, '필수 각성체 추가', [['','선택'], ...links.characters.map(row => [row.clientId, charName(row.clientId)])]);
        const exclude = select(inputs, '제외 각성체 추가', [['','선택'], ...links.characters.map(row => [row.clientId, charName(row.clientId)])]);
        const realm = select(inputs, '각성체 선택 목록 영역', [['','전체'],['chaos','혼돈'],['aequor','심해'],['caro','혈육'],['ultra','초차원']]);
        const availability = select(inputs, '각성체 선택 목록 구분', [['','전체'],['standard','상시'],['limited','한정']]);
        const characterSearch = field(inputs, '각성체 선택 목록 이름 검색', '', 'search');
        const updateChoices = () => { const rows = links.characters.filter(row => { const entry = manifest.find(item => item.id === row.siteId); return (!realm.value || entry?.relems === realm.value) && (!availability.value || row.availability === availability.value) && (!characterSearch.value || charName(row.clientId).includes(characterSearch.value.trim())); }); for (const control of [include, exclude]) { control.replaceChildren(new Option('선택', '')); for (const row of rows) control.add(new Option(charName(row.clientId), row.clientId)); } }; realm.addEventListener('change', updateChoices); availability.addEventListener('change', updateChoices); characterSearch.addEventListener('input', updateChoices);
        const chosen = node('div', undefined, 'records-actions'); form.append(chosen);
        let included = [...(initial.include ?? [])], excluded = [...(initial.exclude ?? [])]; const ranges = { ...(initial.growth ?? {}) };
        const drawSelected = () => { chosen.replaceChildren(); for (const [kind, list] of [['include',included],['exclude',excluded]]) for (const tid of list) {
            const group = panel(chosen, `${kind === 'include' ? '필수' : '제외'}: ${charName(tid)}`); button(group, '제거', () => { if (kind === 'include') included = included.filter(id => id !== tid); else excluded = excluded.filter(id => id !== tid); delete ranges[tid]; drawSelected(); });
            if (kind === 'include') { const min = field(group, '계령 최저', ranges[tid]?.min ?? 0, 'number'), max = field(group, '계령 최고', ranges[tid]?.max ?? 15, 'number'); for (const el of [min,max]) { el.min=0;el.max=15;el.step=1;el.addEventListener('change',()=>{ranges[tid]={min:Number(min.value),max:Number(max.value)};}); } } } };
        for (const [control,kind] of [[include,'include'],[exclude,'exclude']]) control.addEventListener('change', () => { const tid=control.value;if(!tid)return;if(included.includes(tid)||excluded.includes(tid)){status.textContent='이미 선택한 각성체입니다.';return;}if(kind==='include'&&included.length===4){status.textContent='필수 각성체는 최대 4명입니다.';return;} (kind==='include'?included:excluded).push(tid);control.value='';drawSelected(); }); drawSelected();
        const mode = select(inputs, '모드', [['dzone','융재금구'],['pdive','환몽심잠'],['railway','열차']], initial.mode ?? 'dzone');
        const season = field(inputs, '시즌 ID (비우면 전체)', initial.season ?? '', 'number'); season.min=1;season.max=10000;
        const wave = select(inputs, '파', [['','전체'],...[1,2,3,4,5].map(n=>[n,`${n}파`])], initial.slot ?? '');
        const alert = select(inputs, '난이도', [['','전체'],...['C','B','A','S','SS','SSS'].map((name,i)=>[i+1,name])], initial.alert ?? '');
        const support = check(inputs, '지원 제외', initial.excludeSupport), extra = check(inputs, '추가 클리어만', initial.extraOnly);
        const owned = check(inputs, '보유 각성체로 가능한 편성', initial.ownedCharacters !== undefined), ownWheels = check(inputs, '보유 명륜도 적용', initial.ownedWheels !== undefined), ownGrowth = check(inputs, '보유 계령 상한 적용', initial.ownedPotency !== undefined), allowBorrowed = check(inputs, '보유 조건에서 지원 1명 허용', initial.allowBorrowed);
        const rankMin = field(inputs, '순위 최저 (선택)', initial.rankMin ?? '', 'number'), rankMax = field(inputs, '순위 최고 (선택)', initial.rankMax ?? '', 'number'); rankMin.min=rankMax.min=1;
        button(form, '보유 현황 설정 열기', () => { location.href='inventory_checker.html'; });
        const send = node('button','검색');send.type='submit';send.className='btn-yellow';form.append(send);
        button(form, '검색 초기화', () => { included=[];excluded=[];for(const key of Object.keys(ranges))delete ranges[key];drawSelected();mode.value='dzone';season.value='';wave.value='';alert.value='';rankMin.value='';rankMax.value='';for(const el of [support,extra,owned,ownWheels,ownGrowth,allowBorrowed])el.checked=false; });
        form.addEventListener('submit',event=>{event.preventDefault();try{const filters={mode:mode.value,include:included,exclude:excluded,growth:ranges,excludeSupport:support.checked,extraOnly:extra.checked};
            for(const [key,input] of [['season',season],['slot',wave],['alert',alert],['rankMin',rankMin],['rankMax',rankMax]])if(input.value)filters[key]=Number(input.value);
            if(owned.checked){const inventory=I.ownedFilters(localStorage,links,{wheels:ownWheels.checked,growth:ownGrowth.checked,allowBorrowed:allowBorrowed.checked});if(inventory.unresolved.length)throw Error('보유 목록에 미매핑 항목이 있습니다. 검색 범위를 확인해 주세요.');Object.assign(filters,inventory.filters);}
            submit(F.normalizedFilters(filters));}catch(error){status.textContent=error.message;}});
    }
    function filterParams(filters) { return Object.fromEntries(new URLSearchParams(F.filtersToQuery(filters))); }
    async function clears(filters, options) {
        heading('내 조건에 맞는 실제 클리어'); filtersForm(filters, next=>run(opts=>clears(next,opts)));
        const values=filterParams(filters);history.replaceState(null,'',I.shareUrl(location.href,'clears',values));
        const response=await api.clears(values,options),data=response.data;
        note(content, `${data.total}건 · ${response.coverage ?? '수집 표본'} · 갱신 ${time(response.fetchedAt)} · ${response.globalCoverage ? '전역 범위' : '제한된 표본, 전체 클리어가 아님'}`);
        button(content,'검색 조건 링크 복사',()=>copy(location.href));
        const results=node('div');content.append(results);data.records.forEach(row=>clearCard(results,row));if(!data.total)note(results,'현재 수집된 범위에 일치하는 기록이 없습니다.');
        let offset=data.nextOffset;const more=button(content,'기록 더 보기',()=>run(async opts=>{const r=await api.clears({...values,offset},opts);r.data.records.forEach(row=>clearCard(results,row));offset=r.data.nextOffset;more.disabled=offset===null;},{clear:false}));more.disabled=offset===null;
        for(const group of data.groups.slice(0,100)){const box=panel(content,`${group.tids.map(charName).join(' / ')} · ${group.count}건`);note(box,`파별 분포 ${Object.entries(group.waves).map(([wave,n])=>`${wave}파 ${n}건`).join(' / ')}`);group.records.forEach(row=>clearCard(box,row));}
    }
    async function meta(filters, character, options) {
        heading('융재금구 채용·장비 통계');filtersForm(filters,next=>run(opts=>meta(next,character,opts)));
        const response=await api.meta({...filterParams(filters),character},options),data=response.data;
        note(content,`${data.playerCount}명 / ${data.recordCount}개 기록 · 사람 기준 채용률 · 갱신 ${time(response.fetchedAt)} · ${response.globalCoverage ? '전역 범위' : '제한된 수집 표본'}`);
        if(data.smallSample)note(content,'표본이 적습니다. 이 결과는 육성 추천이나 티어표가 아닙니다.');
        if(data.lowDifficulty)note(content,'낮은 난이도의 기록이 포함되어 있습니다.');
        const controls=node('div',undefined,'records-actions'); content.append(controls);const query=field(controls,'채용률 이름 검색','','search'),order=select(controls,'채용률 정렬',[['count','전체 채용'],['supportCount','지원 채용'],...[1,2,3,4,5].map(n=>['wave'+n,`${n}파 채용`])]);
        const adoption=node('div',undefined,'records-grid');content.append(adoption);const drawAdoption=()=>{adoption.replaceChildren();const value=row=>order.value.startsWith('wave')?row.waves[order.value.slice(4)]??0:row[order.value];for(const row of data.awakeners.filter(row=>charName(row.tid).includes(query.value.trim())).sort((a,b)=>value(b)-value(a)||a.tid.localeCompare(b.tid))){const box=panel(adoption,`${charName(row.tid)} · ${number(row.rate*100)}%`);note(box,`${row.count}명 · 지원 ${row.supportCount}명 · ${Object.entries(row.waves).map(([wave,n])=>`${wave}파 ${n}명`).join(' / ')}`);routeLink(box,'각성체 상세 통계','meta',{...filterParams(filters),character:row.tid});routeLink(box,' 이 각성체의 실제 클리어','clears',filterParams({...filters,include:[row.tid]}));}};query.addEventListener('input',drawAdoption);order.addEventListener('change',drawAdoption);drawAdoption();
        if(data.character){const box=panel(content,`${charName(data.character.tid)} 장비·성장·동료`);note(box,`${data.character.recordCount}개 일치 클리어 기준. 전체 채용률과 분모가 다릅니다.`);
            for(const [key,title] of [['growth','계령 분포'],['wheels','명륜'],['wheelPairs','두 명륜 조합'],['wheelGrowth','명륜 단계'],['covenants','계약 세트'],['silverkeys','은열쇠'],['teammates','함께 쓰는 각성체']]) {
                const details=node('details'); details.append(node('summary',title)); box.append(details);
                table(details,['항목 / 원본 ID','일치 기록 수','비율'],(data.character[key]??[]).map(row=>{let label=key==='growth'?`계령 ${row.key}`:key==='teammates'?charName(row.key):row.key;const tid=key==='wheelGrowth'?row.key.split(':')[0]:row.key;const mapping=(key==='silverkeys'?links.keys:links.wheels).find(item=>String(item.clientId)===tid);if(mapping&&['wheels','wheelGrowth','silverkeys'].includes(key)){const anchor=node('a',`${label} · 도감 보기`);anchor.href=`links.html?category=${key==='silverkeys'?'silverkey':'myeongryun'}#${encodeURIComponent(mapping.siteId)}`;label=anchor;}return[label,row.count,number(row.rate*100)+'%'];}));
                if(!data.character[key]?.length)note(details,'이 표본에 확인된 항목이 없습니다.');
            }
            for(const group of data.character.parties)routeLink(box,`${group.tids.map(charName).join(' / ')} ${group.count}건`,'clears',filterParams({...filters,include:group.tids}));}
        for(const [key,title] of [['partyGroups','4인 편성'],['coreGroups','핵심 3인 조합·넷째 자리']]){const box=panel(content,title),minimum=field(box,'조합 최소 플레이어 수',1,'number');minimum.min=1;minimum.max=1000000;const list=node('div');box.append(list);const draw=()=>{list.replaceChildren();for(const group of data[key]?.groups??[])if(group.playerCount>=Number(minimum.value)&&group.tids){const item=panel(list,group.tids.map(charName).join(' / '));note(item,`${group.playerCount}명 / ${group.recordCount}개 클리어${group.smallSample?' · 소표본':''}`);routeLink(item,'이 조합의 실제 클리어','clears',filterParams({...filters,include:group.tids}));for(const fourth of group.fourth??[])routeLink(item,` ${charName(fourth.tid)}: ${fourth.playerCount}명 (${number(fourth.rate*100)}%)`,'clears',filterParams({...filters,include:[...group.tids,fourth.tid]}));}};minimum.addEventListener('change',draw);draw();if(data[key]?.truncated)note(box,`최대 ${data[key].maximum}개 조합만 표시합니다. 조건을 좁혀 추가 조합을 찾으세요.`);disclosure(box,'사람 기준 건수·표본 제한',data[key]);}
    }
    async function leaderboard(params, options) {
        heading('랭킹');const controls=node('form',undefined,'records-actions');content.append(controls);
        const mode=select(controls,'모드',[['dzone','융재금구'],['pdive','환몽심잠'],['railway','열차'],['collection','수집']],params.mode??'dzone');
        const seasons=await catalog.seasons(undefined,options);const season=select(controls,'시즌',[['','현재'],...seasons.data.seasons.filter(row=>row.mode===mode.value).map(row=>[row.season,`시즌 ${row.season}`])],params.season??'');
        const submit=node('button','조회');submit.type='submit';controls.append(submit);controls.addEventListener('submit',event=>{event.preventDefault();run(opts=>leaderboard({mode:mode.value,...(mode.value!=='collection'&&season.value?{season:season.value}:{})},opts));});
        mode.addEventListener('change',()=>{season.replaceChildren(new Option('현재',''));for(const row of seasons.data.seasons.filter(row=>row.mode===mode.value))season.add(new Option(`시즌 ${row.season}`,row.season));season.disabled=mode.value==='collection';});
        const response=await api.leaderboard({...params,limit:20},options);const box=panel(content,'순위 목록');
        const podium=node('div',undefined,'records-grid');content.insertBefore(podium,box);for(const row of response.data.podium??[]){const card=panel(podium,`${row.rank}위 · ${row.name}`);image(card,row.avatar?.image,row.avatar?.name??'아바타');note(card,number(row.score));routeLink(card,'공개 프로필·도전 기록','profile',{uid:row.uid});}
        const add=rows=>rows.forEach(row=>{const item=node('div',undefined,'records-actions');image(item,row.avatar?.image,row.avatar?.name??'아바타');routeLink(item,`${row.rank}위 · ${row.name} · ${number(row.score)}`,'profile',{uid:row.uid});box.append(item);});add(response.data.entries);
        let offset=response.data.nextOffset;const more=button(content,'다음 순위 보기',()=>run(async opts=>{const r=await api.leaderboard({...params,offset,limit:20},opts);add(r.data.entries);offset=r.data.nextOffset;more.disabled=offset===null;},{clear:false}));more.disabled=offset===null;
        routeLink(content,'이 시즌의 채용 통계','meta',{mode:params.mode??'dzone',season:params.season});
    }
    async function events(params, options) {
        heading('이벤트·배너·보상');const controls=node('form',undefined,'records-actions');content.append(controls);
        const category=select(controls,'유형',[['all','전체'],['current','현재'],['task','임무'],['trial','체험'],['attendance','출석'],['banner','배너']],params.category??'current');
        const buttonEl=node('button','적용');buttonEl.type='submit';controls.append(buttonEl);controls.addEventListener('submit',event=>{event.preventDefault();run(opts=>events({category:category.value},opts));});
        const r=await catalog.events(params,options);note(content,`설정 일정 ${r.data.events.length}건 · 서버 노출·개인별 참여 가능 여부는 미확정입니다. 보상은 확인된 참조만 집계합니다.`);
        for(const event of r.data.events){const box=panel(content,event.name);note(box,`${time(event.start)} ~ ${time(event.end)} · ${event.status==='current'?'일정 진행 중':event.status==='upcoming'?'예정':'종료'}`);if(event.description)note(box,event.description);if(event.tasks?.length)table(box,['임무','설명'],event.tasks.map(task=>[task.name??task.id,task.description??'']));if(event.rewards?.length){table(box,['확인된 보상','수량','획득 조건'],event.rewards.map(reward=>[reward.name??reward.itemTid,number(reward.count),reward.requiresPass?'패스 필요':'일반']));note(box,'임무·일차별 항목입니다. 같은 이름의 보상을 중복 합산한 전체 획득량이 아닙니다.');}disclosure(box,'임무·출석·체험·일반/패스 보상',event);}
        const rules=await catalog.eventTimeRules({limit:100},options);const box=panel(content,`개인별·상대 일정 ${rules.data.total}건`);note(box,'트리거 기준과 개방 조건만 확인할 수 있습니다. 개인별 시작일은 임의로 계산하지 않습니다.');
        for(const rule of rules.data.entries)disclosure(box,`${rule.name} · ${rule.timeType}`,rule);
        let offset=rules.data.nextOffset;const more=button(box,'일정 규칙 더 보기',()=>run(async opts=>{const page=await catalog.eventTimeRules({offset,limit:100},opts);page.data.entries.forEach(rule=>disclosure(box,`${rule.name} · ${rule.timeType}`,rule));offset=page.data.nextOffset;more.disabled=offset===null;},{clear:false}));more.disabled=offset===null;
    }
    async function relics(params, options) {
        heading('전체 유물 도감');const controls=node('form',undefined,'records-actions');content.append(controls);
        const query=field(controls,'이름·효과 검색',params.query??''),tier=select(controls,'등급',[['','전체'],['gold','금'],['silver','은'],['cursed','저주'],['blessed','축복'],['sinful','죄']],params.tier??'');
        const origin=select(controls,'출처',[['','전체'],['faded_legacy','유산'],['abyss','융재금구'],['pvp','PvP'],['event','이벤트'],['astral_reign','별의 정위']],params.origin??'');
        const mechanic=select(controls,'작동 원리',[['','전체'],['offense','피해·힘'],['healing','회복'],['shield','방어막'],['draw','카드 뽑기'],['arithmetica','계산'],['aliemus','광기'],['exalt','광기 폭발'],['debuff','디버프']],params.mechanic??'');
        const level=field(controls,'계정 레벨',params.level??65,'number');level.min=1;level.max=100;level.step=1;
        const archive=field(controls,'Archive Mark (확인된 문맥만)',params.archiveNotch??0,'number');archive.min=0;archive.max=100;archive.step=1;
        const send=node('button','검색');send.type='submit';controls.append(send);controls.addEventListener('submit',event=>{event.preventDefault();run(opts=>relics({query:query.value,tier:tier.value,origin:origin.value,mechanic:mechanic.value,level:Number(level.value),archiveNotch:Number(archive.value)},opts));});
        const r=await catalog.relics(params,options);note(content,`${r.data.itemCount}묶음 / ${r.data.variantCount}개 ID · 테스트·이벤트 항목 포함, 현재 수집 가능 목록과 다릅니다.`);
        const grid=node('div',undefined,'records-grid');content.append(grid);
        for(const relic of r.data.relics){const box=panel(grid,relic.name);image(box,relic.image,relic.name);
            const variant=select(box,'모드·등급·단조 변형',relic.variants.map(row=>[row.id,`${row.name} · ${row.origin??row.chapter??''} · ${row.quality} · ID ${row.id}`]),relic.variants[0].id);
            const detail=node('div');box.append(detail);const draw=async()=>{try{const result=await catalog.relic(Number(variant.value),{level:Number(level.value),archiveNotch:Number(archive.value)},options);detail.replaceChildren(node('p',result.data.variant.description));if(!result.data.variant.resolved)note(detail,`미확정 인자: ${result.data.variant.unresolved.join(', ')}. 필요한 전투 문맥은 0으로 가정하지 않습니다.`);}catch(error){detail.textContent=error.message;}};
            button(box,'선택한 변형 수치·설명',draw);variant.addEventListener('change',draw);
        }
    }
    function about() {
        heading('출처·개인정보·업데이트');note(content,'비공식 팬사이트입니다. 게임 서버의 공개 조회 결과와 게임 클라이언트 설정을 구분해 사용합니다.');
        note(content,'최근 조회와 보유 현황은 브라우저 로컬 저장소에 있습니다. 사용자 이미지는 업로드하지 않습니다. 공개 조회는 조회용 PC의 Steam 인증·게임 버전에 영향을 받습니다.');
        note(content,'실전 기록 분석과 ScareCrow 재실행은 다른 기능입니다. 빌드를 가져와도 같은 난수·유물·시작 상태·피해가 재현된다고 보장하지 않습니다.');
        panel(content,'2026-10-08 · 실전 기능 연결').append(node('p','조건별 검색·보유 현황·기록 빌드·이미지 저장·파티/ScareCrow 가져오기·랭킹·통계·정적 도감·이벤트 연결을 추가했습니다. 공개 게임 조회 서버 연결 여부는 별도로 표시합니다.'));
        button(content,'데모 체험',()=>run(demo));button(content,'최근 조회 모두 삭제',()=>{recent.clear();recentList();status.textContent='최근 조회를 삭제했습니다. 보유 현황과 편성은 유지됩니다.';});
    }
    async function home(options) {
        heading('실전 정보 시작하기');const grid=node('div',undefined,'records-grid');content.append(grid);
        const preview=panel(grid,'전투 분석 체험');note(preview,'UID 없이 데모의 턴별 기여량과 빌드 이미지 저장을 체험할 수 있습니다.');button(preview,'데모 전투 열기',()=>run(demo));
        const metaPreview=panel(grid,'채용 통계·내 조건 검색');note(metaPreview,'보유 각성체·명륜·계령 상한으로 실제 클리어를 좁히고, 확인한 빌드를 편성 도구나 ScareCrow로 가져오세요.');routeLink(metaPreview,'전체 채용률','meta');routeLink(metaPreview,' 보유 조건 검색','clears');
        try { const sample=await api.meta({mode:'dzone'},options);note(metaPreview,`${sample.data.playerCount}명 / ${sample.data.recordCount}개 기록 · ${sample.globalCoverage?'전역 범위':'제한된 수집 표본'}`);for(const row of sample.data.awakeners.slice(0,5))routeLink(metaPreview,` ${charName(row.tid)} ${number(row.rate*100)}%`,'meta',{mode:'dzone',character:row.tid}); }catch(error){if(error.name==='AbortError')throw error;note(metaPreview,'실시간 통계 미리보기를 불러올 수 없습니다. 조회 서버 연결 상태를 확인해 주세요.');}
        const eventPreview=panel(grid,'이벤트 일정 미리보기');const r=await catalog.events({category:'current'},options);for(const event of r.data.events.slice(0,3))note(eventPreview,`${event.name} · ${time(event.end)}까지`);if(!r.data.events.length)note(eventPreview,'설정 일정에서 진행 중인 항목이 없습니다. 서버의 실제 노출 상태는 별도입니다.');routeLink(eventPreview,'전체 이벤트·보상','events');
        const update=panel(grid,'2026-10-08 · 새 기능');note(update,'실전 기록 검색, 빌드 공유 이미지, 보유 현황 연동, 편성·ScareCrow 가져오기를 연결했습니다.');routeLink(update,'출처·개인정보·변경 기록','about');
        if(!['127.0.0.1','localhost'].includes(location.hostname)){try{const health=await api.health(options);if(!health.configurationPresent||health.hostConnected===false)throw Error();note(content,'현재 PC와 조회 중계가 연결되어 있습니다. Steam·게임 버전·PC 상태에 따라 실제 조회 가능 여부가 달라집니다.');}catch(error){if(error.name==='AbortError')throw error;note(content,'공개 게임 조회 PC에 연결할 수 없습니다. 데모·이벤트·전체 유물 도감은 조회 서버 없이 사용할 수 있습니다.');}}
    }
    async function demo() { currentReview=RecordDemo.create(links,manifest);currentParty=F.partyFromReview(currentReview);currentParty.provenance.source='synthetic-demo';history.replaceState(null,'','?view=review&demo=1');await renderReview(true); }
    async function route(options) {
        const params=new URLSearchParams(location.search),view=params.get('view')??'home';
        for(const el of document.querySelectorAll('.records-nav a')){if(new URL(el.href).searchParams.get('view')===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}
        if(view==='review'&&params.get('demo')==='1')return demo();
        if(view==='home')return home(options);
        if(view==='profile'){if(!params.get('uid'))throw Error('UID를 입력해 주세요.');$('profile-uid').value=params.get('uid');return profile(params.get('uid'),options);}
        if(view==='review'){if(!params.get('code'))throw Error('리플레이 코드를 입력해 주세요.');return review(params.get('code'),options);}
        if(view==='leaderboard'){return leaderboard({mode:params.get('mode')??'dzone',...(params.has('season')?{season:params.get('season')}:{})},options);}
        if(view==='events')return events({category:params.get('category')??'current'},options);
        if(view==='relics')return relics({query:params.get('query')??''},options);
        if(view==='about')return about();
        if(!['clears','meta'].includes(view))throw Error('알 수 없는 페이지입니다.');
        const filters=new URLSearchParams(params);filters.delete('view');filters.delete('character');
        const parsed=F.filtersFromQuery(filters.toString());return view==='meta'?meta(parsed,params.get('character')??undefined,options):clears(parsed,options);
    }
    $('profile-search').addEventListener('submit',event=>{event.preventDefault();location.href=I.shareUrl(location.href,'profile',{uid:$('profile-uid').value.trim()});});
    $('replay-search').addEventListener('submit',event=>{event.preventDefault();location.href=I.shareUrl(location.href,'review',{code:$('replay-code').value.trim()});});
    $('open-demo').addEventListener('click',()=>run(demo));
    window.addEventListener('pagehide',()=>{controller?.abort();for(const url of blobs)URL.revokeObjectURL(url);});
    try {
        const results=await Promise.all(['data/record_links.json','data/character_manifest.json'].map(async path=>{const response=await fetch(path);if(!response.ok)throw Error('공통 연결 자료를 불러오지 못했습니다.');return response.json();}));[links,manifest]=results;
        if(links.source!=='client-config'||links.schemaVersion!==1)throw Error('검증되지 않은 공통 연결 자료입니다.');
        recentList();await run(route);
    }catch(error){status.textContent=error.message;status.className='records-error';}
})();
