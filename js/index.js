import {
    CHARACTER_CLASS_LABELS,
    RELEMS_LABELS
} from './domain/character-taxonomy.js?v=v1.4.0-site-quality-20260713-r4';

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const filterForm = document.getElementById('character-filters');
    const searchInput = document.getElementById('search-bar');
    const relemsFilter = document.getElementById('relems-filter');
    const gradeFilter = document.getElementById('grade-filter');
    const classFilter = document.getElementById('class-filter');
    const characterGrid = document.getElementById('character-grid');
    const resultCount = document.getElementById('result-count');
    const emptyState = document.getElementById('character-empty');

    if (!filterForm || !searchInput || !relemsFilter || !gradeFilter
        || !classFilter || !characterGrid || !resultCount || !emptyState) {
        return;
    }

    const validFilters = {
        relems: new Set(['all', 'chaos', 'aequor', 'caro', 'ultra']),
        grade: new Set(['all', 'ssr', 'sr']),
        className: new Set(['all', 'assault', 'warden', 'chorus'])
    };
    const state = {
        cards: [],
        filters: {
            relems: 'all',
            grade: 'all',
            className: 'all',
            search: ''
        }
    };

    function safeFilterValue(value, allowed) {
        return allowed.has(value) ? value : 'all';
    }

    function readFiltersFromUrl() {
        const params = new URLSearchParams(window.location.search);
        state.filters.search = String(params.get('q') || '').slice(0, 80);
        state.filters.relems = safeFilterValue(params.get('relems') || 'all', validFilters.relems);
        state.filters.grade = safeFilterValue(params.get('grade') || 'all', validFilters.grade);
        state.filters.className = safeFilterValue(params.get('role') || 'all', validFilters.className);

        searchInput.value = state.filters.search;
        relemsFilter.value = state.filters.relems;
        gradeFilter.value = state.filters.grade;
        classFilter.value = state.filters.className;
    }

    function syncFiltersToUrl() {
        const url = new URL(window.location.href);
        const values = {
            q: state.filters.search,
            relems: state.filters.relems,
            grade: state.filters.grade,
            role: state.filters.className
        };
        Object.entries(values).forEach(([key, value]) => {
            if (!value || value === 'all') url.searchParams.delete(key);
            else url.searchParams.set(key, value);
        });
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    function createCharacterCard(character) {
        const relems = validFilters.relems.has(character.relems) ? character.relems : 'chaos';
        const grade = validFilters.grade.has(character.grade) ? character.grade : 'sr';
        const className = validFilters.className.has(character.class) ? character.class : 'chorus';
        const name = String(character.name || '이름 미상');
        const id = String(character.id || '');
        const originalImage = String(character.image_thumb || '');
        const modernImage = originalImage.replace(/\.png$/i, '.webp');

        const params = new URLSearchParams({ category: 'character', id });
        const link = document.createElement('a');
        link.className = 'card-link';
        link.href = `links.html?${params.toString()}`;
        link.setAttribute('aria-label', `${name} 정보 보기`);

        const card = document.createElement('article');
        card.className = 'character-card';

        const image = document.createElement('img');
        image.src = modernImage || originalImage;
        image.alt = `${name} 각성체`;
        image.width = 180;
        image.height = 180;
        image.loading = 'lazy';
        image.decoding = 'async';
        if (modernImage && modernImage !== originalImage) {
            image.addEventListener('error', () => {
                if (image.src.endsWith(modernImage)) image.src = originalImage;
            }, { once: true });
        }

        const relemsTag = document.createElement('span');
        relemsTag.className = `relems-tag ${relems}`;
        relemsTag.textContent = RELEMS_LABELS[relems] || relems;

        const heading = document.createElement('h3');
        heading.textContent = name;

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const role = document.createElement('p');
        role.textContent = CHARACTER_CLASS_LABELS[className] || className;
        const gradeLabel = document.createElement('span');
        gradeLabel.className = 'grade-label';
        gradeLabel.textContent = grade.toUpperCase();
        meta.append(role, gradeLabel);

        card.append(image, relemsTag, heading, meta);
        link.append(card);

        return {
            element: link,
            data: { relems, grade, className, name }
        };
    }

    function matchesSearch(name, query) {
        return window.SearchUtils
            ? window.SearchUtils.matchesSearchText(name, query)
            : name.toLocaleLowerCase('ko').includes(query.toLocaleLowerCase('ko'));
    }

    function applyFilters({ updateUrl = true } = {}) {
        let visibleCount = 0;
        state.cards.forEach(({ element, data }) => {
            const visible =
                (state.filters.relems === 'all' || data.relems === state.filters.relems)
                && (state.filters.grade === 'all' || data.grade === state.filters.grade)
                && (state.filters.className === 'all' || data.className === state.filters.className)
                && matchesSearch(data.name, state.filters.search);
            element.hidden = !visible;
            if (visible) visibleCount += 1;
        });

        resultCount.textContent = `전체 ${state.cards.length}명 중 ${visibleCount}명을 표시합니다.`;
        emptyState.classList.toggle('hidden', visibleCount !== 0);
        if (updateUrl) syncFiltersToUrl();
    }

    function bindFilterEvents() {
        searchInput.addEventListener('input', () => {
            state.filters.search = searchInput.value.trim().slice(0, 80);
            applyFilters();
        });
        relemsFilter.addEventListener('change', () => {
            state.filters.relems = safeFilterValue(relemsFilter.value, validFilters.relems);
            applyFilters();
        });
        gradeFilter.addEventListener('change', () => {
            state.filters.grade = safeFilterValue(gradeFilter.value, validFilters.grade);
            applyFilters();
        });
        classFilter.addEventListener('change', () => {
            state.filters.className = safeFilterValue(classFilter.value, validFilters.className);
            applyFilters();
        });
        filterForm.addEventListener('reset', () => {
            window.requestAnimationFrame(() => {
                state.filters = {
                    relems: 'all',
                    grade: 'all',
                    className: 'all',
                    search: ''
                };
                applyFilters();
                searchInput.focus();
            });
        });
    }

    function renderLoadError(error) {
        const wrapper = document.createElement('div');
        wrapper.className = 'error-state';
        const message = document.createElement('p');
        message.textContent = '각성체 목록을 불러오지 못했습니다.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'filter-reset';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', loadCharacters);
        wrapper.append(message, retry);
        characterGrid.replaceChildren(wrapper);
        characterGrid.setAttribute('aria-busy', 'false');
        resultCount.textContent = '데이터 로드에 실패했습니다.';
        console.error('각성체 목록 로드 실패:', error);
    }

    async function loadCharacters() {
        characterGrid.setAttribute('aria-busy', 'true');
        resultCount.textContent = '각성체 목록을 불러오는 중입니다.';
        emptyState.classList.add('hidden');

        try {
            const response = await fetch('data/character_manifest.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const characters = await response.json();
            if (!Array.isArray(characters)) throw new TypeError('Character manifest must be an array.');

            const fragment = document.createDocumentFragment();
            state.cards = characters
                .filter((character) => character && character.id && character.name && character.image_thumb)
                .map(createCharacterCard);
            state.cards.forEach(({ element }) => fragment.append(element));
            characterGrid.replaceChildren(fragment);
            characterGrid.setAttribute('aria-busy', 'false');
            applyFilters({ updateUrl: false });
        } catch (error) {
            state.cards = [];
            renderLoadError(error);
        }
    }

    readFiltersFromUrl();
    bindFilterEvents();
    loadCharacters();
});
