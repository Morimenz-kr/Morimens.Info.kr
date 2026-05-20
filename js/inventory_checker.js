(function () {
    const STORAGE_KEY = 'morimens_inventory_checker_v2';
    const LEGACY_STORAGE_KEYS = ['morimens_inventory_checker_v1'];
    const FALLBACK_IMAGE = 'images/smile_Ramona.webp';
    const GROUP_LABELS = {
        standard: '통상',
        forgotten: '망각편',
        celestial: '성신편'
    };
    const RELEMS_LABELS = {
        chaos: '혼돈',
        aequor: '심해',
        caro: '혈육',
        ultra: '초차원'
    };
    const RELEMS_ORDER = ['chaos', 'aequor', 'caro', 'ultra'];
    const BREAKTHROUGH_LABELS = ['명함', '1돌', '2돌', '3돌', '4돌', '5돌', '6돌', '초한', '8돌', '9돌', '10돌', '11돌', '12돌', '13돌', '14돌', '풀돌'];

    const LINKED_CHARACTER_BREAKTHROUGH_GROUPS = [
        ['ramona', 'ramona_timeworn']
    ];
    const LINKED_CHARACTER_BREAKTHROUGH_MAP = LINKED_CHARACTER_BREAKTHROUGH_GROUPS.reduce((map, group) => {
        group.forEach(id => {
            map[id] = group;
        });
        return map;
    }, {});

    const state = {
        tab: 'characters',
        characterFilter: 'all',
        wheelFilter: 'all',
        search: '',
        characters: [],
        wheels: [],
        groupByCharacterId: {},
        selectedCharacters: new Set(),
        selectedWheels: new Set(),
        characterBreakthroughs: {},
        wheelBreakthroughs: {}
    };

    const els = {};

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        cacheElements();
        bindEvents();
        loadSavedState();

        try {
            const ts = Date.now();
            const [characters, wheels, gachatype] = await Promise.all([
                fetch(`data/character_manifest.json?t=${ts}`).then(res => res.json()),
                fetch(`data/wheel_list.json?t=${ts}`).then(res => res.json()),
                fetch(`data/gachatype.json?t=${ts}`).then(res => res.json())
            ]);

            state.characters = characters;
            state.wheels = getInventoryWheels(wheels);
            state.groupByCharacterId = buildGroupMap(gachatype);
            removeUnavailableCharacterBreakthroughs();
            removeUnavailableWheelSelections();

            renderAll();
        } catch (error) {
            console.error('보유량 체크 데이터 로드 실패:', error);
            els.characterGrid.innerHTML = '<div class="empty-selection">데이터를 불러오지 못했습니다.</div>';
        }
    }

    function cacheElements() {
        els.tabButtons = document.querySelectorAll('[data-tab-button]');
        els.characterFilters = document.querySelectorAll('[data-character-filter]');
        els.wheelFilters = document.querySelectorAll('[data-wheel-filter]');
        els.search = document.getElementById('inventory-search');
        els.characterGrid = document.getElementById('character-grid');
        els.wheelGrid = document.getElementById('wheel-grid');
        els.characterFiltersBox = document.getElementById('character-filters');
        els.wheelFiltersBox = document.getElementById('wheel-filters');
        els.characterCount = document.getElementById('character-count');
        els.wheelCount = document.getElementById('wheel-count');
        els.copyBtn = document.getElementById('copy-image-btn');
        els.previewBtn = document.getElementById('preview-image-btn');
        els.clearBtn = document.getElementById('clear-selection-btn');
        els.selectVisibleBtn = document.getElementById('select-visible-btn');
        els.deselectVisibleBtn = document.getElementById('deselect-visible-btn');
        els.copyStatus = document.getElementById('copy-status');
        els.previewModal = document.getElementById('preview-modal');
        els.previewImage = document.getElementById('preview-image');
        els.closePreviewModal = document.getElementById('close-preview-modal');
    }

    function bindEvents() {
        els.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                state.tab = button.dataset.tabButton;
                state.search = '';
                els.search.value = '';
                renderAll();
            });
        });

        els.characterFilters.forEach(button => {
            button.addEventListener('click', () => {
                state.characterFilter = button.dataset.characterFilter;
                renderAll();
            });
        });

        els.wheelFilters.forEach(button => {
            button.addEventListener('click', () => {
                state.wheelFilter = button.dataset.wheelFilter;
                renderAll();
            });
        });

        els.search.addEventListener('input', event => {
            state.search = event.target.value.trim().toLowerCase();
            renderAll();
        });

        els.characterGrid.addEventListener('click', event => {
            if (event.target.closest('[data-breakthrough-stepper]')) return;
            const card = event.target.closest('[data-character-id]');
            if (card) toggleCharacter(card.dataset.characterId);
        });
        els.characterGrid.addEventListener('keydown', event => {
            if (event.target.closest('[data-breakthrough-stepper]')) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('[data-character-id]');
            if (!card) return;
            event.preventDefault();
            toggleCharacter(card.dataset.characterId);
        });
        els.characterGrid.addEventListener('click', event => {
            const control = event.target.closest('[data-breakthrough-control]');
            if (control) updateBreakthrough(control.dataset.breakthroughType, control.dataset.breakthroughId, control.dataset.breakthroughDirection);
        });
        els.wheelGrid.addEventListener('click', event => {
            const control = event.target.closest('[data-breakthrough-control]');
            if (control) {
                updateBreakthrough(control.dataset.breakthroughType, control.dataset.breakthroughId, control.dataset.breakthroughDirection);
                return;
            }
            if (event.target.closest('[data-breakthrough-stepper]')) return;
            const card = event.target.closest('[data-wheel-id]');
            if (card) toggleWheel(card.dataset.wheelId);
        });
        els.wheelGrid.addEventListener('keydown', event => {
            if (event.target.closest('[data-breakthrough-control]')) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('[data-wheel-id]');
            if (!card) return;
            event.preventDefault();
            toggleWheel(card.dataset.wheelId);
        });
        els.copyBtn.addEventListener('click', copySelectionImage);
        els.previewBtn.addEventListener('click', openPreviewModal);
        els.clearBtn.addEventListener('click', clearSelection);
        els.selectVisibleBtn.addEventListener('click', selectVisibleItems);
        els.deselectVisibleBtn.addEventListener('click', deselectVisibleItems);
        els.closePreviewModal.addEventListener('click', closePreviewModal);
        els.previewModal.addEventListener('click', event => {
            if (event.target === els.previewModal) closePreviewModal();
        });
    }

    function buildGroupMap(gachatype) {
        const map = {};
        Object.entries(gachatype).forEach(([group, ids]) => {
            ids.forEach(id => {
                map[id] = group;
            });
        });
        return map;
    }

    function loadSavedState() {
        LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));

        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!saved) return;
            state.selectedCharacters = new Set(saved.characters || []);
            state.selectedWheels = new Set(saved.wheels || []);
            state.characterBreakthroughs = normalizeBreakthroughs(saved.characterBreakthroughs || {});
            state.wheelBreakthroughs = normalizeBreakthroughs(saved.wheelBreakthroughs || {});
        } catch (error) {
            console.warn('저장된 보유량 체크 상태를 읽지 못했습니다.', error);
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            characters: Array.from(state.selectedCharacters),
            wheels: Array.from(state.selectedWheels),
            characterBreakthroughs: state.characterBreakthroughs,
            wheelBreakthroughs: state.wheelBreakthroughs
        }));
    }

    function renderAll() {
        renderTabs();
        renderFilters();
        renderCharacters();
        renderWheels();
        renderSelection();
    }

    function renderTabs() {
        els.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tabButton === state.tab);
        });
        els.characterGrid.classList.toggle('hidden', state.tab !== 'characters');
        els.wheelGrid.classList.toggle('hidden', state.tab !== 'wheels');
        els.characterFiltersBox.classList.toggle('hidden', state.tab !== 'characters');
        els.wheelFiltersBox.classList.toggle('hidden', state.tab !== 'wheels');
    }

    function renderFilters() {
        els.characterFilters.forEach(button => {
            button.classList.toggle('active', button.dataset.characterFilter === state.characterFilter);
        });
        els.wheelFilters.forEach(button => {
            button.classList.toggle('active', button.dataset.wheelFilter === state.wheelFilter);
        });
    }

    function renderCharacters() {
        const filtered = state.characters.filter(character => {
            const group = state.groupByCharacterId[character.id] || 'standard';
            const groupMatch = state.characterFilter === 'all' || group === state.characterFilter;
            const textMatch = !state.search || character.name.toLowerCase().includes(state.search);
            return groupMatch && textMatch;
        });

        const grouped = RELEMS_ORDER.map(relems => ({
            relems,
            characters: filtered.filter(character => character.relems === relems)
        })).filter(group => group.characters.length > 0);

        els.characterGrid.innerHTML = grouped.map(group => `
            <section class="relems-section ${escapeAttribute(group.relems)}" aria-label="${escapeAttribute(RELEMS_LABELS[group.relems] || group.relems)}">
                <div class="relems-section-title">${escapeHtml(RELEMS_LABELS[group.relems] || group.relems)}</div>
                <div class="relems-character-grid">
                    ${group.characters.map(character => renderCharacterCard(character)).join('')}
                </div>
            </section>
        `).join('');
    }

    function renderCharacterCard(character) {
            const selected = state.selectedCharacters.has(character.id);
            const group = state.groupByCharacterId[character.id] || 'standard';
            const breakthrough = getCharacterBreakthrough(character.id);
            return `
                <div role="button" tabindex="0" class="inventory-card character-inventory-card ${selected ? 'selected' : ''}"
                        data-character-id="${escapeAttribute(character.id)}"
                        title="${escapeAttribute(character.name)} (${GROUP_LABELS[group] || '통상'})">
                    <span class="check-mark">✓</span>
                    <img src="${escapeAttribute(character.image_thumb)}" alt="${escapeAttribute(character.name)}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
                    <span class="inventory-card-name">${escapeHtml(character.name)}</span>
                    ${selected ? renderBreakthroughStepper('character', character.id, breakthrough) : ''}
                </div>
            `;
    }

    function renderBreakthroughStepper(type, id, value) {
        const label = getBreakthroughLabel(value);

        return `
            <span class="breakthrough-stepper" data-breakthrough-stepper>
                <button type="button"
                        class="breakthrough-stepper-btn"
                        data-breakthrough-control
                        data-breakthrough-type="${escapeAttribute(type)}"
                        data-breakthrough-id="${escapeAttribute(id)}"
                        data-breakthrough-direction="-1"
                        aria-label="돌파 단계 낮추기">&lt;</button>
                <span class="breakthrough-stepper-label">${escapeHtml(label)}</span>
                <button type="button"
                        class="breakthrough-stepper-btn"
                        data-breakthrough-control
                        data-breakthrough-type="${escapeAttribute(type)}"
                        data-breakthrough-id="${escapeAttribute(id)}"
                        data-breakthrough-direction="1"
                        aria-label="돌파 단계 올리기">&gt;</button>
            </span>
        `;
    }

    function renderWheels() {
        const filtered = state.wheels.filter(wheel => {
            if (!isShareWheel(wheel)) return false;
            const gradeMatch = state.wheelFilter === 'all' || wheel.grade === state.wheelFilter;
            const text = `${wheel.korean_name || ''} ${wheel.main_stat || ''}`.toLowerCase();
            const textMatch = !state.search || text.includes(state.search);
            return gradeMatch && textMatch;
        });

        els.wheelGrid.innerHTML = filtered.map(wheel => {
            const selected = state.selectedWheels.has(wheel.english_name);
            const breakthrough = getWheelBreakthrough(wheel.english_name);
            return `
                <div role="button" tabindex="0" class="inventory-card wheel-inventory-card ${selected ? 'selected' : ''}"
                        data-wheel-id="${escapeAttribute(wheel.english_name)}"
                        data-wheel-grade="${escapeAttribute(normalizeGrade(wheel.grade))}"
                        title="${escapeAttribute(wheel.korean_name || wheel.english_name)}">
                    <span class="check-mark">✓</span>
                    <img src="${escapeAttribute(wheel.image_path)}" alt="${escapeAttribute(wheel.korean_name || wheel.english_name)}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
                    ${selected ? renderBreakthroughStepper('wheel', wheel.english_name, breakthrough) : ''}
                </div>
            `;
        }).join('');
    }

    function toggleCharacter(id) {
        if (state.selectedCharacters.has(id)) {
            state.selectedCharacters.delete(id);
            delete state.characterBreakthroughs[id];
        } else {
            state.selectedCharacters.add(id);
            setCharacterBreakthrough(id, getCharacterBreakthrough(id));
        }
        saveState();
        renderAll();
    }

    function toggleWheel(id) {
        if (state.selectedWheels.has(id)) {
            state.selectedWheels.delete(id);
            delete state.wheelBreakthroughs[id];
        } else {
            state.selectedWheels.add(id);
            state.wheelBreakthroughs[id] = getWheelBreakthrough(id);
        }
        saveState();
        renderAll();
    }

    function toggleSetValue(set, value) {
        if (set.has(value)) set.delete(value);
        else set.add(value);
    }

    function updateBreakthrough(type, id, direction) {
        if (type === 'character') {
            if (!state.selectedCharacters.has(id)) return;
            setCharacterBreakthrough(id, stepBreakthrough(getCharacterBreakthrough(id), direction));
        }
        if (type === 'wheel') {
            if (!state.selectedWheels.has(id)) return;
            state.wheelBreakthroughs[id] = stepBreakthrough(getWheelBreakthrough(id), direction);
        }
        saveState();
        renderAll();
    }

    function getCharacterBreakthrough(id) {
        return getLinkedCharacterBreakthroughIds(id).reduce((value, linkedId) => {
            if (!Object.prototype.hasOwnProperty.call(state.characterBreakthroughs, linkedId)) return value;
            return Math.max(value, clampBreakthrough(state.characterBreakthroughs[linkedId]));
        }, 0);
    }

    function setCharacterBreakthrough(id, value) {
        const breakthrough = clampBreakthrough(value);
        getLinkedCharacterBreakthroughIds(id).forEach(linkedId => {
            if (state.selectedCharacters.has(linkedId)) {
                state.characterBreakthroughs[linkedId] = breakthrough;
            }
        });
    }

    function getLinkedCharacterBreakthroughIds(id) {
        return LINKED_CHARACTER_BREAKTHROUGH_MAP[id] || [id];
    }

    function getWheelBreakthrough(id) {
        return clampBreakthrough(state.wheelBreakthroughs[id]);
    }

    function renderSelection() {
        const characters = state.characters.filter(character => state.selectedCharacters.has(character.id));
        const wheels = state.wheels.filter(wheel => state.selectedWheels.has(wheel.english_name));

        els.characterCount.textContent = characters.length;
        els.wheelCount.textContent = wheels.length;

    }

    function clearSelection() {
        state.selectedCharacters.clear();
        state.selectedWheels.clear();
        state.characterBreakthroughs = {};
        state.wheelBreakthroughs = {};
        saveState();
        setStatus('선택을 초기화했습니다.', 'success');
        renderAll();
    }

    function selectVisibleItems() {
        const ids = getVisibleIds();
        if (state.tab === 'characters') {
            ids.forEach(id => {
                state.selectedCharacters.add(id);
                setCharacterBreakthrough(id, getCharacterBreakthrough(id));
            });
        } else {
            ids.forEach(id => {
                state.selectedWheels.add(id);
                state.wheelBreakthroughs[id] = getWheelBreakthrough(id);
            });
        }
        saveState();
        setStatus('현재 목록을 모두 선택했습니다.', 'success');
        renderAll();
    }

    function deselectVisibleItems() {
        const ids = getVisibleIds();
        if (state.tab === 'characters') {
            ids.forEach(id => {
                state.selectedCharacters.delete(id);
                delete state.characterBreakthroughs[id];
            });
        } else {
            ids.forEach(id => {
                state.selectedWheels.delete(id);
                delete state.wheelBreakthroughs[id];
            });
        }
        saveState();
        setStatus('현재 목록을 모두 해제했습니다.', 'success');
        renderAll();
    }

    function getVisibleIds() {
        if (state.tab === 'characters') {
            return state.characters
                .filter(character => {
                    const group = state.groupByCharacterId[character.id] || 'standard';
                    const groupMatch = state.characterFilter === 'all' || group === state.characterFilter;
                    const textMatch = !state.search || character.name.toLowerCase().includes(state.search);
                    return groupMatch && textMatch;
                })
                .map(character => character.id);
        }

        return state.wheels
            .filter(wheel => {
                if (!isShareWheel(wheel)) return false;
                const gradeMatch = state.wheelFilter === 'all' || wheel.grade === state.wheelFilter;
                const text = `${wheel.korean_name || ''} ${wheel.main_stat || ''}`.toLowerCase();
                const textMatch = !state.search || text.includes(state.search);
                return gradeMatch && textMatch;
            })
            .map(wheel => wheel.english_name);
    }

    async function copySelectionImage() {
        const selectedCharacters = state.characters.filter(character => state.selectedCharacters.has(character.id));
        const selectedWheels = state.wheels.filter(wheel => state.selectedWheels.has(wheel.english_name));

        if (selectedCharacters.length + selectedWheels.length === 0) {
            setStatus('복사할 항목을 먼저 선택해주세요.', 'error');
            return;
        }

        setStatus('이미지를 만드는 중입니다...', '');

        try {
            const canvas = await createShareCanvas(selectedCharacters, getShareWheels(selectedWheels));
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('이미지 변환 실패');

            if (navigator.clipboard && window.ClipboardItem) {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    setStatus('이미지를 클립보드에 복사했습니다.', 'success');
                    return;
                } catch (error) {
                    console.warn('클립보드 이미지 쓰기 실패, fallback을 엽니다.', error);
                }
            }

            openImageFallback(blob);
            setStatus('브라우저가 이미지 복사를 막아 새 탭으로 열었습니다.', 'error');
        } catch (error) {
            console.error('이미지 복사 실패:', error);
            setStatus('이미지 복사에 실패했습니다. 브라우저 권한을 확인해주세요.', 'error');
        }
    }

    async function openPreviewModal() {
        const selectedCharacters = state.characters.filter(character => state.selectedCharacters.has(character.id));
        const selectedWheels = state.wheels.filter(wheel => state.selectedWheels.has(wheel.english_name));

        if (selectedCharacters.length + selectedWheels.length === 0) {
            setStatus('미리보기할 항목을 먼저 선택해주세요.', 'error');
            return;
        }

        setStatus('미리보기를 준비하는 중입니다...', '');

        try {
            const canvas = await createShareCanvas(selectedCharacters, getShareWheels(selectedWheels));
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('이미지 변환 실패');
            closePreviewModal();
            const url = URL.createObjectURL(blob);
            els.previewImage.src = url;
            els.previewImage.dataset.objectUrl = url;
            els.previewModal.classList.add('show');
            setStatus('', '');
        } catch (error) {
            console.error('이미지 미리보기 실패:', error);
            setStatus('미리보기를 만들지 못했습니다.', 'error');
        }
    }

    function closePreviewModal() {
        const url = els.previewImage.dataset.objectUrl;
        if (url) {
            URL.revokeObjectURL(url);
            delete els.previewImage.dataset.objectUrl;
        }
        els.previewImage.removeAttribute('src');
        els.previewModal.classList.remove('show');
    }

    async function createShareCanvas(characters, wheels) {
        const visibleWheels = getShareWheels(wheels);
        const padding = 28;
        const gap = 12;
        const titleHeight = 0;
        const sectionHeader = 34;
        const characterCard = { width: 116, height: 176, imageHeight: 116 };
        const wheelCard = { width: 103, height: 255, imageHeight: 209 };
        const characterCols = 9;
        const wheelCols = 10;
        const characterGridWidth = characterCols * characterCard.width + (characterCols - 1) * gap;
        const wheelGridWidth = wheelCols * wheelCard.width + (wheelCols - 1) * gap;
        const sectionWidth = Math.max(characterGridWidth, wheelGridWidth);
        const width = sectionWidth + padding * 2;
        const characterRows = Math.max(1, Math.ceil(characters.length / characterCols));
        const wheelRows = Math.max(1, Math.ceil(visibleWheels.length / wheelCols));
        const height = padding + titleHeight + sectionHeader + (characterRows * characterCard.height) + ((characterRows - 1) * gap)
            + 24 + sectionHeader + (wheelRows * wheelCard.height) + ((wheelRows - 1) * gap) + padding;

        const canvas = document.createElement('canvas');
        const scale = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#202024';
        ctx.fillRect(0, 0, width, height);

        let y = padding + titleHeight;
        y = await drawSection(ctx, '각성체', characters, {
            x: padding,
            y,
            cols: characterCols,
            card: characterCard,
            gap,
            sectionWidth,
            drawName: true,
            showName: false,
            getImage: item => item.image_thumb,
            getName: item => item.name,
            getBadge: item => getBreakthroughLabel(getCharacterBreakthrough(item.id))
        });

        y += 24;
        await drawSection(ctx, '명륜', visibleWheels, {
            x: padding,
            y,
            cols: wheelCols,
            card: wheelCard,
            gap,
            sectionWidth,
            drawName: false,
            getImage: item => item.image_path,
            getName: item => item.korean_name || item.english_name,
            getBadge: item => getBreakthroughLabel(getWheelBreakthrough(item.english_name))
        });

        return canvas;
    }

    async function drawSection(ctx, title, items, options) {
        const { x, cols, card, gap, drawName, getImage, getName, getBadge } = options;
        const showName = options.showName !== false;
        let y = options.y;
        const contentWidth = options.sectionWidth || (cols * card.width + (cols - 1) * gap);
        const gridWidth = cols * card.width + (cols - 1) * gap;
        const gridOffsetX = Math.max(0, (contentWidth - gridWidth) / 2);

        ctx.fillStyle = '#2a2a2e';
        roundRect(ctx, x - 10, y, contentWidth + 20, 30, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 16px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, x + contentWidth / 2, y + 21);
        ctx.textAlign = 'left';
        y += 42;

        if (items.length === 0) {
            ctx.strokeStyle = '#444444';
            ctx.setLineDash([5, 5]);
            roundRect(ctx, x, y, contentWidth, card.height, 6);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#777777';
            ctx.font = '700 14px Pretendard, sans-serif';
            ctx.fillText(`선택된 ${title} 없음`, x + 18, y + 34);
            return y + card.height;
        }

        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cardX = x + gridOffsetX + col * (card.width + gap);
            const cardY = y + row * (card.height + gap);

            ctx.fillStyle = '#2a2a2a';
            roundRect(ctx, cardX, cardY, card.width, card.height, 6);
            ctx.fill();

            const image = await loadImage(getImage(item));
            const imgWidth = drawName ? card.width - 10 : card.width;
            const imgHeight = card.imageHeight;
            const imgX = cardX + (card.width - imgWidth) / 2;
            const imgY = cardY + 5;
            drawImageCover(ctx, image, imgX, imgY, imgWidth, imgHeight);

            if (drawName && showName) {
                ctx.fillStyle = '#dddddd';
                ctx.font = '700 11px Pretendard, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(truncateText(ctx, getName(item), card.width - 8), cardX + card.width / 2, cardY + card.imageHeight + 23);
                if (getBadge) {
                    drawBreakthroughBadge(ctx, getBadge(item), cardX + card.width / 2, cardY + card.imageHeight + 34);
                }
                ctx.textAlign = 'left';
            } else if (drawName && getBadge) {
                drawBreakthroughBadge(ctx, getBadge(item), cardX + card.width / 2, cardY + card.imageHeight + 18, {
                    fontSize: 17,
                    minWidth: 54,
                    paddingX: 24,
                    height: 30
                });
            } else if (getBadge) {
                drawBreakthroughBadge(ctx, getBadge(item), cardX + card.width / 2, cardY + card.imageHeight + 11, {
                    fontSize: 17,
                    minWidth: 54,
                    paddingX: 24,
                    height: 30
                });
            }
        }

        return y + Math.ceil(items.length / cols) * card.height + (Math.ceil(items.length / cols) - 1) * gap;
    }

    function loadImage(src) {
        return new Promise(resolve => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => {
                if (src !== FALLBACK_IMAGE) {
                    loadImage(FALLBACK_IMAGE).then(resolve);
                } else {
                    resolve(null);
                }
            };
            image.src = src || FALLBACK_IMAGE;
        });
    }

    function drawImageCover(ctx, image, x, y, width, height) {
        ctx.save();
        roundRect(ctx, x, y, width, height, 5);
        ctx.clip();
        ctx.fillStyle = '#111111';
        ctx.fillRect(x, y, width, height);
        if (image) {
            const scale = Math.max(width / image.width, height / image.height);
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
        }
        ctx.restore();
        ctx.strokeStyle = '#4a4a4a';
        roundRect(ctx, x, y, width, height, 5);
        ctx.stroke();
    }

    function drawBreakthroughBadge(ctx, label, centerX, y, options = {}) {
        ctx.save();
        const fontSize = options.fontSize || 12;
        const height = options.height || 20;
        ctx.font = `700 ${fontSize}px Pretendard, sans-serif`;
        const width = Math.max(options.minWidth || 38, ctx.measureText(label).width + (options.paddingX || 16));
        const x = centerX - width / 2;

        ctx.fillStyle = 'rgba(10, 10, 10, 0.78)';
        roundRect(ctx, x, y, width, height, height / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(label, centerX, y + Math.round(height / 2 + fontSize * 0.35));
        ctx.textAlign = 'left';
        ctx.restore();
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function truncateText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let value = text;
        while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
            value = value.slice(0, -1);
        }
        return `${value}…`;
    }

    function openImageFallback(blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    function normalizeGrade(grade) {
        return String(grade || '').trim().toUpperCase();
    }

    function normalizeBreakthroughs(values) {
        return Object.entries(values).reduce((result, [id, value]) => {
            result[id] = clampBreakthrough(value);
            return result;
        }, {});
    }

    function clampBreakthrough(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(0, Math.min(BREAKTHROUGH_LABELS.length - 1, parsed));
    }

    function stepBreakthrough(value, direction) {
        const next = clampBreakthrough(value) + Number.parseInt(direction, 10);
        if (next < 0) return BREAKTHROUGH_LABELS.length - 1;
        if (next >= BREAKTHROUGH_LABELS.length) return 0;
        return next;
    }

    function getBreakthroughLabel(value) {
        return BREAKTHROUGH_LABELS[clampBreakthrough(value)] || BREAKTHROUGH_LABELS[0];
    }

    function getShareWheels(wheels) {
        return wheels.filter(isSsrWheel);
    }

    function getInventoryWheels(wheels) {
        return wheels.filter(isShareWheel);
    }

    function isShareWheel(wheel) {
        const grade = normalizeGrade(wheel.grade);
        return grade === 'SSR' || grade === 'SR';
    }

    function isSsrWheel(wheel) {
        return normalizeGrade(wheel.grade) === 'SSR';
    }

    function removeUnavailableWheelSelections() {
        const available = new Set(state.wheels.filter(isShareWheel).map(wheel => wheel.english_name));
        let changed = false;
        state.selectedWheels.forEach(id => {
            if (!available.has(id)) {
                state.selectedWheels.delete(id);
                delete state.wheelBreakthroughs[id];
                changed = true;
            }
        });
        Object.keys(state.wheelBreakthroughs).forEach(id => {
            if (!available.has(id) || !state.selectedWheels.has(id)) {
                delete state.wheelBreakthroughs[id];
                changed = true;
            }
        });
        state.selectedWheels.forEach(id => {
            if (!Object.prototype.hasOwnProperty.call(state.wheelBreakthroughs, id)) {
                state.wheelBreakthroughs[id] = 0;
                changed = true;
            }
        });
        if (changed) saveState();
    }

    function removeUnavailableCharacterBreakthroughs() {
        const available = new Set(state.characters.map(character => character.id));
        let changed = false;

        Object.keys(state.characterBreakthroughs).forEach(id => {
            if (!available.has(id) || !state.selectedCharacters.has(id)) {
                delete state.characterBreakthroughs[id];
                changed = true;
            }
        });

        state.selectedCharacters.forEach(id => {
            if (!Object.prototype.hasOwnProperty.call(state.characterBreakthroughs, id)) {
                setCharacterBreakthrough(id, getCharacterBreakthrough(id));
                changed = true;
            }
        });

        LINKED_CHARACTER_BREAKTHROUGH_GROUPS.forEach(group => {
            const selectedIds = group.filter(id => state.selectedCharacters.has(id));
            if (selectedIds.length < 2) return;
            const breakthrough = selectedIds.reduce((value, id) => Math.max(value, getCharacterBreakthrough(id)), 0);
            selectedIds.forEach(id => {
                if (state.characterBreakthroughs[id] !== breakthrough) {
                    state.characterBreakthroughs[id] = breakthrough;
                    changed = true;
                }
            });
        });

        if (changed) saveState();
    }

    function setStatus(message, type) {
        els.copyStatus.textContent = '';
        els.copyStatus.className = 'copy-status';
        if (!message) return;

        const existing = document.querySelector('.inventory-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `inventory-toast ${type || ''}`.trim();
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 2600);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }
})();
