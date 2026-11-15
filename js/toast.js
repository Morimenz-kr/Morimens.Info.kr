(function () {
    'use strict';
    if (window.MorimensToast) return;
    let active = null, timer = 0, settings = {};

    function clear() {
        clearTimeout(timer);
        active?.remove();
        active = null;
    }

    function position() {
        if (!active?.isConnected) return;
        const host = active.parentElement;
        const footer = host !== document.body ? host.querySelector('.dialog-footer') : null;
        const offset = Math.max(settings.offset ?? 34, footer ? innerHeight - footer.getBoundingClientRect().top + 12 : 0);
        active.style.setProperty('--toast-offset', offset + 'px');
        active.classList.remove('at-top');
        const focus = document.activeElement;
        if (!focus || focus === document.body) return;
        const n = active.getBoundingClientRect(), f = focus.getBoundingClientRect();
        if (f.bottom > n.top - 8 && f.top < n.bottom + 8 && f.right > n.left && f.left < n.right) active.classList.add('at-top');
    }

    function show(message, options = {}) {
        clear();
        if (!message) return;
        settings = options;
        const duration = options.duration ?? 2600;
        const toast = document.createElement('div');
        toast.className = 'morimens-toast';
        if (options.type === 'success' || options.type === 'error') toast.classList.add(options.type);
        toast.setAttribute('role', options.type === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-atomic', 'true');
        toast.textContent = message;
        toast.style.setProperty('--toast-duration', duration + 'ms');
        const host = [...document.querySelectorAll('dialog[open]')].at(-1) || document.body;
        host.appendChild(toast);
        active = toast;
        position();
        timer = setTimeout(clear, duration);
        return toast;
    }

    window.MorimensToast = Object.freeze({ show, clear });
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, { capture: true, passive: true });
    document.addEventListener('focusin', position);
    document.addEventListener('close', event => { if (active && event.target.contains(active)) clear(); }, true);
})();
