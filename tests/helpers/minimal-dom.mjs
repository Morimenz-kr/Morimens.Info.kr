class FakeClassList {
    constructor(element) {
        this.element = element;
        this.values = new Set();
    }

    setFromString(value) {
        this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
    }

    add(...values) {
        values.forEach(value => this.values.add(value));
    }

    remove(...values) {
        values.forEach(value => this.values.delete(value));
    }

    contains(value) {
        return this.values.has(value);
    }

    toggle(value, force) {
        const enabled = force === undefined ? !this.contains(value) : Boolean(force);
        if (enabled) this.add(value);
        else this.remove(value);
        return enabled;
    }

    toString() {
        return [...this.values].join(' ');
    }
}

export class MinimalElement extends EventTarget {
    constructor(ownerDocument, tagName = 'div') {
        super();
        this.ownerDocument = ownerDocument;
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.style = {};
        this.attributes = new Map();
        this.classList = new FakeClassList(this);
        this.hidden = false;
        this.inert = false;
        this.id = '';
        this.textContent = '';
        this.scrollTop = 0;
        this.tabIndex = 0;
        this.isRoot = false;
    }

    get className() {
        return this.classList.toString();
    }

    set className(value) {
        this.classList.setFromString(value);
    }

    get parentElement() {
        return this.parentNode;
    }

    get nextSibling() {
        if (!this.parentNode) return null;
        const index = this.parentNode.children.indexOf(this);
        return index >= 0 ? this.parentNode.children[index + 1] || null : null;
    }

    get isConnected() {
        return this.isRoot || Boolean(this.parentNode?.isConnected);
    }

    append(...nodes) {
        nodes.forEach(node => {
            if (!(node instanceof MinimalElement)) return;
            node.parentNode?.removeChild(node);
            node.parentNode = this;
            this.children.push(node);
        });
    }

    insertBefore(node, reference) {
        node.parentNode?.removeChild(node);
        const index = this.children.indexOf(reference);
        node.parentNode = this;
        if (index < 0) this.children.push(node);
        else this.children.splice(index, 0, node);
        return node;
    }

    removeChild(node) {
        const index = this.children.indexOf(node);
        if (index >= 0) this.children.splice(index, 1);
        node.parentNode = null;
        return node;
    }

    replaceChildren(...nodes) {
        [...this.children].forEach(child => this.removeChild(child));
        this.append(...nodes);
    }

    contains(node) {
        return node === this || this.children.some(child => child.contains(node));
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'id') this.id = String(value);
    }

    getAttribute(name) {
        if (name === 'id') return this.id || null;
        return this.attributes.get(name) ?? null;
    }

    hasAttribute(name) {
        return name === 'id' ? Boolean(this.id) : this.attributes.has(name);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    querySelector(selector) {
        if (selector.startsWith('#')) {
            const id = selector.slice(1);
            if (this.id === id) return this;
            for (const child of this.children) {
                const match = child.querySelector(selector);
                if (match) return match;
            }
        }
        return null;
    }

    closest(selector) {
        let current = this;
        while (current) {
            const role = current.getAttribute('role');
            if (selector.includes('[role="dialog"]') && role === 'dialog') return current;
            if (selector.includes('[role="alertdialog"]') && role === 'alertdialog') return current;
            if (
                selector.includes('.modal-overlay.show')
                && current.classList.contains('modal-overlay')
                && current.classList.contains('show')
            ) return current;
            current = current.parentNode;
        }
        return null;
    }

    getBoundingClientRect() {
        return { left: 20, right: 60, top: 20, bottom: 60, width: 40, height: 40 };
    }

    getClientRects() {
        return this.hidden ? [] : [this.getBoundingClientRect()];
    }

    focus() {
        this.ownerDocument.activeElement = this;
    }
}

export class MinimalDocument extends EventTarget {
    constructor() {
        super();
        this.activeElement = null;
        this.body = new MinimalElement(this, 'body');
        this.body.isRoot = true;
    }

    createElement(tagName) {
        return new MinimalElement(this, tagName);
    }
}

export function createMinimalWindow(document) {
    return {
        document,
        HTMLElement: MinimalElement,
        innerWidth: 1024,
        innerHeight: 768,
        requestAnimationFrame(callback) {
            callback();
            return 1;
        },
        setTimeout(callback) {
            callback();
            return 1;
        },
        clearTimeout() {}
    };
}

export function createKeyboardEvent(type, properties = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.entries(properties).forEach(([key, value]) => {
        Object.defineProperty(event, key, { configurable: true, value });
    });
    return event;
}
