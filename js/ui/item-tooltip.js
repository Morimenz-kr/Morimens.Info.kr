function createElement(document, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
}

function ensureSection(document, tooltip, id, className) {
    const existing = tooltip.querySelector(`#${id}`);
    if (existing) return existing;
    const section = createElement(document, 'div', className);
    section.id = id;
    tooltip.append(section);
    return section;
}

export function createItemTooltipController(options = {}) {
    const {
        document,
        window,
        lookupItem = () => null,
        decodeMainStats = () => [],
        formatMainStats = values => values.join(', '),
        positionTooltip,
        tooltipElement = null,
        tooltipId = 'global-tooltip',
        visibleClass = ''
    } = options;
    if (!document?.body || !window || typeof lookupItem !== 'function') {
        throw new TypeError('Item tooltip controller requires document and window.');
    }

    const tooltip = tooltipElement || createElement(document, 'div', 'item-tooltip');
    tooltip.id = tooltip.id || tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.tabIndex = -1;

    const title = ensureSection(document, tooltip, 'tt-title', 'tooltip-title');
    const description = ensureSection(document, tooltip, 'tt-desc', 'tooltip-desc');
    const tags = ensureSection(document, tooltip, 'tt-tags', 'tooltip-tags');
    tooltip.setAttribute('aria-labelledby', title.id);
    if (!tooltip.isConnected) document.body.append(tooltip);

    let activeTrigger = null;
    let pinned = false;
    let suppressedFocusTrigger = null;
    let portalReturn = null;

    function getTooltipContext(trigger) {
        if (!trigger?.closest) return null;
        return trigger.closest('[role="dialog"], [role="alertdialog"], .modal-overlay.show');
    }

    function restoreTooltipPortal() {
        if (!portalReturn) return;
        const { parent, nextSibling, wasInert } = portalReturn;
        portalReturn = null;
        if (parent?.isConnected) {
            if (nextSibling?.parentNode === parent) parent.insertBefore(tooltip, nextSibling);
            else parent.append(tooltip);
        } else if (document.body) {
            document.body.append(tooltip);
        }
        tooltip.inert = wasInert;
    }

    function moveTooltipToTriggerContext(trigger) {
        const context = getTooltipContext(trigger);
        if (!context || context === tooltip.parentNode) {
            if (portalReturn) tooltip.inert = false;
            return;
        }
        restoreTooltipPortal();
        portalReturn = {
            parent: tooltip.parentNode,
            nextSibling: tooltip.nextSibling,
            wasInert: Boolean(tooltip.inert)
        };
        context.append(tooltip);
        tooltip.inert = false;
    }

    function appendLine(container, text, className = 'tooltip-effect-desc') {
        if (text === undefined || text === null || text === '') return;
        container.append(createElement(document, 'div', className, text));
    }

    function render(item, mainStats) {
        title.textContent = item?.korean_name || '정보 없음';
        description.replaceChildren();
        if (item?.main_stat) appendLine(description, `주옵션: ${item.main_stat}`, 'tooltip-main-stat');
        if (item?.description) appendLine(description, item.description);
        if (item?.set_effect_3) {
            appendLine(description, '3세트 효과', 'tooltip-effect-desc tooltip-effect-heading');
            appendLine(description, item.set_effect_3, 'tooltip-effect-desc tooltip-effect-body');
        }
        if (item?.set_effect_6) {
            appendLine(description, '6세트 효과', 'tooltip-effect-desc tooltip-effect-heading');
            appendLine(description, item.set_effect_6, 'tooltip-effect-desc tooltip-effect-body');
        }
        if (item?.source) {
            appendLine(description, '획득처', 'tooltip-effect-desc tooltip-effect-heading tooltip-effect-heading-large');
            appendLine(description, item.source, 'tooltip-effect-desc tooltip-effect-body tooltip-effect-muted');
        }
        if (mainStats.length > 0) {
            appendLine(description, '추천 주옵션', 'tooltip-effect-desc tooltip-effect-heading tooltip-effect-heading-large');
            appendLine(description, formatMainStats(mainStats), 'tooltip-effect-desc tooltip-effect-body tooltip-effect-muted');
        }

        tags.replaceChildren();
        (item?.tags || item?.optimized_for || [])
            .map(tag => String(tag || '').trim())
            .filter(Boolean)
            .forEach(tag => tags.append(createElement(document, 'span', 'tooltip-tag', tag)));
    }

    function setVisible(visible) {
        if (visibleClass) tooltip.classList.toggle(visibleClass, visible);
        tooltip.style.display = visible ? 'block' : 'none';
        tooltip.setAttribute('aria-hidden', String(!visible));
    }

    function defaultPosition(event) {
        const targetRect = event?.currentTarget?.getBoundingClientRect?.()
            || event?.target?.getBoundingClientRect?.();
        const pointerX = Number.isFinite(event?.clientX) && event.clientX > 0
            ? event.clientX
            : (targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth / 2);
        const pointerY = Number.isFinite(event?.clientY) && event.clientY > 0
            ? event.clientY
            : (targetRect ? targetRect.bottom : window.innerHeight / 2);
        let x = pointerX + 15;
        let y = pointerY + 15;
        const rect = tooltip.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = Math.max(8, pointerX - rect.width - 15);
        if (y + rect.height > window.innerHeight) y = Math.max(8, pointerY - rect.height - 15);
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    function move(event) {
        if (tooltip.getAttribute('aria-hidden') === 'true') return;
        if (typeof positionTooltip === 'function') positionTooltip({ event, tooltip, window });
        else defaultPosition(event);
    }

    function show(item, event, mainStats = [], showOptions = {}) {
        const shouldPin = showOptions.pinned === true;
        if (activeTrigger && activeTrigger !== event?.currentTarget) {
            activeTrigger.classList.remove('active');
            activeTrigger.setAttribute('aria-expanded', 'false');
        }
        activeTrigger = event?.currentTarget instanceof window.HTMLElement ? event.currentTarget : null;
        moveTooltipToTriggerContext(activeTrigger);
        pinned = shouldPin;
        render(item, mainStats);
        tooltip.scrollTop = 0;
        tooltip.dataset.pinned = String(pinned);
        tooltip.setAttribute('role', pinned ? 'dialog' : 'tooltip');
        tooltip.tabIndex = pinned ? 0 : -1;
        if (pinned) tooltip.setAttribute('aria-modal', 'false');
        else tooltip.removeAttribute('aria-modal');
        activeTrigger?.setAttribute('aria-expanded', String(pinned));
        setVisible(true);
        move(event);
        if (pinned) window.requestAnimationFrame(() => tooltip.focus({ preventScroll: true }));
    }

    function hide(hideOptions = {}) {
        const { force = false, restoreFocus = false } = hideOptions;
        if (pinned && !force) return;
        const returnTarget = activeTrigger;
        pinned = false;
        tooltip.dataset.pinned = 'false';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.tabIndex = -1;
        tooltip.removeAttribute('aria-modal');
        setVisible(false);
        returnTarget?.classList.remove('active');
        returnTarget?.setAttribute('aria-expanded', 'false');
        activeTrigger = null;
        restoreTooltipPortal();
        if (restoreFocus && returnTarget?.isConnected) {
            suppressedFocusTrigger = returnTarget;
            returnTarget.focus({ preventScroll: true });
            window.setTimeout(() => {
                if (suppressedFocusTrigger === returnTarget) suppressedFocusTrigger = null;
            }, 0);
        }
    }

    function bindTrigger(trigger, item, mainStats = [], bindOptions = {}) {
        if (!trigger || !item || trigger.dataset.tooltipBound === 'true') return;
        let longPressTimer = null;
        let longPressActivated = false;
        let pointerStart = null;
        const activatePreview = event => {
            if (pinned) return;
            if (suppressedFocusTrigger === trigger && event.type === 'focus') {
                suppressedFocusTrigger = null;
                return;
            }
            if (bindOptions.toggleActive) trigger.classList.add('active');
            show(item, event, mainStats);
        };
        const pinTooltip = event => {
            if (bindOptions.toggleActive) trigger.classList.add('active');
            show(item, event, mainStats, { pinned: true });
        };
        const cancelLongPress = () => {
            if (longPressTimer !== null) window.clearTimeout(longPressTimer);
            longPressTimer = null;
            pointerStart = null;
        };

        trigger.dataset.tooltipBound = 'true';
        trigger.setAttribute('aria-controls', tooltip.id);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.addEventListener('pointerenter', activatePreview);
        trigger.addEventListener('pointermove', event => {
            move(event);
            if (!pointerStart || longPressTimer === null) return;
            if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 10) cancelLongPress();
        });
        trigger.addEventListener('pointerleave', event => {
            cancelLongPress();
            hide(event);
        });
        if (bindOptions.pinOnLongPress) {
            trigger.addEventListener('pointerdown', event => {
                if (pinned || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
                cancelLongPress();
                pointerStart = { x: event.clientX, y: event.clientY };
                const pinEvent = {
                    currentTarget: trigger,
                    target: trigger,
                    clientX: event.clientX,
                    clientY: event.clientY
                };
                longPressTimer = window.setTimeout(() => {
                    longPressTimer = null;
                    longPressActivated = true;
                    pinTooltip(pinEvent);
                    window.setTimeout(() => { longPressActivated = false; }, 750);
                }, 500);
            });
            trigger.addEventListener('pointerup', cancelLongPress);
            trigger.addEventListener('pointercancel', cancelLongPress);
            trigger.addEventListener('contextmenu', event => {
                if (longPressActivated || (pinned && activeTrigger === trigger)) event.preventDefault();
            });
        }
        trigger.addEventListener('focus', activatePreview);
        trigger.addEventListener('blur', hide);
        trigger.addEventListener('keydown', event => {
            if (!bindOptions.pinWithAltArrow || !event.altKey || event.key !== 'ArrowDown') return;
            event.preventDefault();
            event.stopPropagation();
            pinTooltip(event);
        });
        trigger.addEventListener('click', event => {
            if (longPressActivated) {
                longPressActivated = false;
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (bindOptions.pinOnClick === false) return;
            event.preventDefault();
            event.stopPropagation();
            if (pinned && activeTrigger === trigger) {
                hide({ force: true, restoreFocus: true });
                return;
            }
            pinTooltip(event);
        });
    }

    function bind(root) {
        if (!root) return;
        root.querySelectorAll('[data-tooltip-kind][data-tooltip-id]').forEach(trigger => {
            const item = lookupItem(trigger.dataset.tooltipKind, trigger.dataset.tooltipId);
            if (!item) return;
            bindTrigger(trigger, item, decodeMainStats(trigger.dataset.tooltipMainStats));
        });
    }

    tooltip.addEventListener('click', event => event.stopPropagation());
    tooltip.addEventListener('focusout', event => {
        if (!pinned || tooltip.contains(event.relatedTarget) || event.relatedTarget === activeTrigger) return;
        hide({ force: true });
    });
    document.addEventListener('click', () => hide({ force: true }));
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || tooltip.getAttribute('aria-hidden') === 'true') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        hide({ force: true, restoreFocus: true });
    }, true);

    return Object.freeze({ bind, bindTrigger, hide, move, show });
}
