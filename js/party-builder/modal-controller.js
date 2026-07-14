export function createPartyModalController(options = {}) {
    const {
        document,
        window,
        getFallbackSelector = () => '',
        onClose = () => {}
    } = options;
    if (!document?.body || !window) throw new TypeError('Modal controller requires document and window.');

    let stack = [];
    let deferredReturnFocus = null;
    let focusGuardPending = false;
    let initialized = false;
    const returnFocusRecords = new Map();
    const backgroundInertState = new Map();
    const backgroundObserver = typeof window.MutationObserver === 'function'
        ? new window.MutationObserver(() => {
            if (stack.length > 0) syncLayers();
        })
        : null;

    function getDialog(overlay) {
        return overlay?.querySelector('[role="dialog"], [role="alertdialog"]') || null;
    }

    function getFocusable(container) {
        if (!container) return [];
        const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return [...container.querySelectorAll(selector)]
            .filter(element => !element.hidden && element.getClientRects().length > 0);
    }

    function createReturnFocusRecord(element) {
        return {
            element,
            fallbackSelector: getFallbackSelector(element) || ''
        };
    }

    function resolveReturnFocusRecord(record) {
        if (
            record?.element?.isConnected
            && !record.element.closest('[hidden], [inert]')
            && record.element.getClientRects().length > 0
        ) {
            return record.element;
        }
        if (!record?.fallbackSelector) return null;
        const fallback = document.querySelector(record.fallbackSelector);
        return fallback && !fallback.closest('[hidden], [inert]') && fallback.getClientRects().length > 0
            ? fallback
            : null;
    }

    function rememberInert(element) {
        if (!backgroundInertState.has(element)) backgroundInertState.set(element, Boolean(element.inert));
    }

    function restoreBackgroundInert() {
        backgroundInertState.forEach((wasInert, element) => {
            if (element.isConnected) element.inert = wasInert;
        });
        backgroundInertState.clear();
    }

    function syncLayers() {
        const topId = stack[stack.length - 1];
        const topOverlay = topId ? document.getElementById(topId) : null;

        if (!topOverlay) {
            backgroundObserver?.disconnect();
            restoreBackgroundInert();
            document.body.classList.remove('modal-open');
            return;
        }

        backgroundObserver?.disconnect();

        [...document.body.children].forEach(child => {
            if (!(child instanceof window.HTMLElement)) return;
            rememberInert(child);
            child.inert = child !== topOverlay && !child.contains(topOverlay);
        });
        stack.forEach(id => {
            const overlay = document.getElementById(id);
            const dialog = getDialog(overlay);
            if (overlay) overlay.inert = id !== topId;
            if (dialog) dialog.inert = id !== topId;
        });
        topOverlay.inert = false;
        const topDialog = getDialog(topOverlay);
        if (topDialog) topDialog.inert = false;
        document.body.classList.add('modal-open');
        backgroundObserver?.observe(document.body, { childList: true });
    }

    function focusTopDialog() {
        if (focusGuardPending) return;
        focusGuardPending = true;
        window.requestAnimationFrame(() => {
            focusGuardPending = false;
            const topDialog = getDialog(document.getElementById(stack[stack.length - 1]));
            (getFocusable(topDialog)[0] || topDialog)?.focus({ preventScroll: true });
        });
    }

    function open(id, initialFocusSelector) {
        const overlay = document.getElementById(id);
        const dialog = getDialog(overlay);
        if (!overlay || !dialog) return;

        if (!overlay.classList.contains('show')) {
            const activeElement = document.activeElement instanceof window.HTMLElement ? document.activeElement : null;
            const returnFocus = deferredReturnFocus || createReturnFocusRecord(activeElement);
            deferredReturnFocus = null;
            returnFocusRecords.set(id, returnFocus);
            stack = stack.filter(openId => openId !== id);
            stack.push(id);
            overlay.hidden = false;
            overlay.classList.add('show');
        }
        syncLayers();

        window.requestAnimationFrame(() => {
            const requested = initialFocusSelector ? dialog.querySelector(initialFocusSelector) : null;
            (requested || getFocusable(dialog)[0] || dialog).focus({ preventScroll: true });
        });
    }

    function close(id, closeOptions = {}) {
        const { restoreFocus = true } = closeOptions;
        const overlay = document.getElementById(id);
        if (!overlay) return;

        overlay.classList.remove('show');
        overlay.hidden = true;
        const dialog = getDialog(overlay);
        if (dialog) dialog.inert = false;
        overlay.inert = false;
        stack = stack.filter(openId => openId !== id);
        onClose(id);
        syncLayers();

        const returnRecord = returnFocusRecords.get(id);
        returnFocusRecords.delete(id);
        if (!restoreFocus) {
            deferredReturnFocus = returnRecord || null;
            queueMicrotask(() => {
                if (deferredReturnFocus === returnRecord) deferredReturnFocus = null;
            });
            return;
        }

        window.requestAnimationFrame(() => {
            const returnTarget = resolveReturnFocusRecord(returnRecord);
            if (returnTarget) {
                returnTarget.focus({ preventScroll: true });
                return;
            }
            const topDialog = getDialog(document.getElementById(stack[stack.length - 1]));
            (getFocusable(topDialog)[0] || topDialog)?.focus({ preventScroll: true });
        });
    }

    function setup() {
        if (initialized) return;
        initialized = true;
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('pointerdown', event => {
                if (event.target !== overlay || overlay.dataset.staticBackdrop === 'true') return;
                close(overlay.id);
            });
        });

        document.addEventListener('focusin', event => {
            const topDialog = getDialog(document.getElementById(stack[stack.length - 1]));
            if (!topDialog || topDialog.contains(event.target)) return;
            event.stopPropagation();
            focusTopDialog();
        }, true);

        document.addEventListener('keydown', event => {
            const topId = stack[stack.length - 1];
            if (!topId) return;
            const dialog = getDialog(document.getElementById(topId));

            if (event.key === 'Escape') {
                event.preventDefault();
                close(topId);
                return;
            }
            if (event.key !== 'Tab' || !dialog) return;

            const focusable = getFocusable(dialog);
            if (!focusable.length) {
                event.preventDefault();
                dialog.focus({ preventScroll: true });
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!dialog.contains(document.activeElement)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus({ preventScroll: true });
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            }
        });
    }

    return Object.freeze({
        clearDeferredReturn() {
            deferredReturnFocus = null;
        },
        close,
        getDialog,
        getFocusable,
        getReturnRecord(id) {
            return returnFocusRecords.get(id);
        },
        getTopId() {
            return stack[stack.length - 1] || null;
        },
        open,
        resolveReturnFocusRecord,
        setup
    });
}
