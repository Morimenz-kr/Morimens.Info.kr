(function () {
    'use strict';

    const instances = new WeakMap();
    const openDialogs = [];
    const isolatedElements = new Map();
    const backgroundObserver = new MutationObserver(() => {
        const dialog = openDialogs.at(-1);
        if (dialog) isolateBackgroundFor(dialog);
    });
    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'area[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'details > summary:first-of-type',
        'iframe',
        '[contenteditable="true"]',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function getFocusableElements(dialog) {
        return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
            .filter((element) => {
                const style = window.getComputedStyle(element);
                return !element.hidden
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && element.getClientRects().length > 0
                    && !element.closest('[inert]');
            });
    }

    function setBodyLock() {
        document.body.classList.toggle('modal-open', openDialogs.length > 0);
    }

    function resetBackgroundIsolation() {
        isolatedElements.forEach((wasInert, element) => {
            element.toggleAttribute('inert', wasInert);
        });
    }

    function restoreBackgroundIsolation() {
        resetBackgroundIsolation();
        isolatedElements.clear();
    }

    function isolateBackgroundFor(dialog) {
        resetBackgroundIsolation();
        let activeBranch = dialog;

        while (activeBranch?.parentElement) {
            const parent = activeBranch.parentElement;
            for (const sibling of parent.children) {
                if (sibling === activeBranch) continue;
                if (!isolatedElements.has(sibling)) {
                    isolatedElements.set(sibling, sibling.hasAttribute('inert'));
                }
                sibling.setAttribute('inert', '');
            }
            if (parent === document.body) break;
            activeBranch = parent;
        }
    }

    function handleKeydown(event) {
        const dialog = openDialogs.at(-1);
        if (!dialog) return;

        const options = instances.get(dialog)?.options || {};
        if (event.key === 'Escape' && options.closeOnEscape !== false) {
            event.preventDefault();
            close(dialog);
            return;
        }

        if (event.key !== 'Tab') return;
        const focusable = getFocusableElements(dialog);
        if (focusable.length === 0) {
            event.preventDefault();
            dialog.querySelector('.modal-content')?.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable.at(-1);
        if (!dialog.contains(document.activeElement)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function handleFocusIn(event) {
        const dialog = openDialogs.at(-1);
        if (!dialog || dialog.contains(event.target)) return;
        const target = getFocusableElements(dialog)[0]
            || dialog.querySelector('.modal-content')
            || dialog;
        target.focus({ preventScroll: true });
    }

    function setup(dialogOrSelector, options = {}) {
        const dialog = typeof dialogOrSelector === 'string'
            ? document.querySelector(dialogOrSelector)
            : dialogOrSelector;
        if (!dialog) return null;

        const previous = instances.get(dialog);
        if (previous) {
            previous.options = { ...previous.options, ...options };
            return dialog;
        }

        const state = {
            options: {
                closeOnBackdrop: true,
                closeOnEscape: true,
                ...options
            },
            returnFocus: null
        };
        instances.set(dialog, state);

        if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-hidden', 'true');
        dialog.toggleAttribute('inert', !dialog.classList.contains('show'));

        dialog.addEventListener('click', (event) => {
            if (event.target.closest('[data-dialog-close]')) {
                close(dialog);
                return;
            }
            if (event.target === dialog && state.options.closeOnBackdrop !== false) {
                close(dialog);
            }
        });

        return dialog;
    }

    function open(dialogOrSelector, trigger = document.activeElement) {
        const dialog = setup(dialogOrSelector);
        if (!dialog || dialog.classList.contains('show')) return dialog;

        const state = instances.get(dialog);
        state.returnFocus = trigger instanceof HTMLElement ? trigger : null;
        dialog.removeAttribute('inert');
        dialog.classList.add('show');
        dialog.setAttribute('aria-hidden', 'false');
        openDialogs.push(dialog);
        isolateBackgroundFor(dialog);
        setBodyLock();

        if (openDialogs.length === 1) {
            document.addEventListener('keydown', handleKeydown, true);
            document.addEventListener('focusin', handleFocusIn, true);
            backgroundObserver.observe(document.body, { childList: true });
        }

        state.options.onOpen?.(dialog);
        requestAnimationFrame(() => {
            const preferred = typeof state.options.initialFocus === 'string'
                ? dialog.querySelector(state.options.initialFocus)
                : state.options.initialFocus;
            const target = preferred
                || getFocusableElements(dialog)[0]
                || dialog.querySelector('.modal-content')
                || dialog;
            if (!target.matches(FOCUSABLE_SELECTOR) && !target.hasAttribute('tabindex')) {
                target.setAttribute('tabindex', '-1');
            }
            target.focus({ preventScroll: true });
        });

        return dialog;
    }

    function close(dialogOrSelector, { restoreFocus = true } = {}) {
        const dialog = typeof dialogOrSelector === 'string'
            ? document.querySelector(dialogOrSelector)
            : dialogOrSelector;
        if (!dialog || !dialog.classList.contains('show')) return dialog;

        const state = instances.get(dialog);
        dialog.classList.remove('show');
        dialog.setAttribute('aria-hidden', 'true');
        dialog.setAttribute('inert', '');

        const index = openDialogs.lastIndexOf(dialog);
        if (index >= 0) openDialogs.splice(index, 1);
        if (openDialogs.length === 0) {
            document.removeEventListener('keydown', handleKeydown, true);
            document.removeEventListener('focusin', handleFocusIn, true);
            backgroundObserver.disconnect();
            restoreBackgroundIsolation();
        } else {
            isolateBackgroundFor(openDialogs.at(-1));
        }
        setBodyLock();
        state?.options.onClose?.(dialog);

        if (restoreFocus && state?.returnFocus?.isConnected) {
            state.returnFocus.focus({ preventScroll: true });
        }
        return dialog;
    }

    function bindTrigger(triggerOrSelector, dialogOrSelector) {
        const triggers = typeof triggerOrSelector === 'string'
            ? document.querySelectorAll(triggerOrSelector)
            : [triggerOrSelector];
        triggers.forEach((trigger) => {
            if (!trigger || trigger.dataset.dialogBound === 'true') return;
            trigger.dataset.dialogBound = 'true';
            trigger.addEventListener('click', () => open(dialogOrSelector, trigger));
        });
    }

    window.SiteDialog = Object.freeze({
        setup,
        open,
        close,
        bindTrigger
    });
})();
