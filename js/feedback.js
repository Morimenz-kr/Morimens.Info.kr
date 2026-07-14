(function () {
    'use strict';

    const REPORT_MODAL_ID = 'report-modal';

    function createReportModal() {
        const template = document.createElement('template');
        template.innerHTML = `
            <div id="${REPORT_MODAL_ID}" class="modal-overlay" role="dialog" aria-modal="true"
                 aria-labelledby="report-modal-title" aria-describedby="report-modal-description">
                <div class="modal-content report-modal-content" tabindex="-1">
                    <button type="button" class="close-btn report-modal-close" data-dialog-close
                            aria-label="제보 창 닫기">&times;</button>
                    <p class="eyebrow">Feedback</p>
                    <h2 id="report-modal-title" class="form-title">버그 및 개선 의견 제보</h2>
                    <p id="report-modal-description" class="report-modal-description">
                        발견한 문제와 재현 방법을 알려 주세요. 제보 내용과 현재 페이지 주소는 공개 GitHub 이슈에 기록될 수 있으므로 개인정보를 입력하지 마세요.
                    </p>
                    <form id="bug-report-form" novalidate>
                        <label for="report-message" class="form-field-label">
                            제보 내용 <span aria-hidden="true">*</span>
                            <span class="report-modal-help">문제가 발생한 순서, 기대한 결과, 실제 결과를 적으면 빠르게 확인할 수 있습니다.</span>
                        </label>
                        <textarea id="report-message" name="message" class="form-textarea"
                                  required minlength="5" maxlength="5000"
                                  aria-describedby="report-message-help"
                                  placeholder="예: 모바일에서 파티 탭을 누르면 마지막 팀이 보이지 않습니다."></textarea>
                        <span id="report-message-help" class="visually-hidden">5자 이상 5,000자 이하로 입력해 주세요.</span>

                        <input type="hidden" name="report_source_url" id="report-source-url">
                        <button type="submit" class="form-submit-btn">제보 보내기</button>
                        <p id="modal-form-status" class="report-modal-status" role="status" aria-live="polite"></p>
                    </form>
                </div>
            </div>
        `;
        document.body.append(template.content);
        return document.getElementById(REPORT_MODAL_ID);
    }

    function ensureReportModal() {
        const modal = document.getElementById(REPORT_MODAL_ID) || createReportModal();
        if (modal.dataset.initialized === 'true') return modal;
        modal.dataset.initialized = 'true';

        window.SiteDialog.setup(modal, {
            initialFocus: '#report-message',
            onClose: () => resetStatus(modal)
        });
        modal.querySelector('#bug-report-form')?.addEventListener('submit', sendFeedbackToWorker);
        return modal;
    }

    function setStatus(modal, message = '', state = '') {
        const status = modal?.querySelector('#modal-form-status');
        if (!status) return;
        status.textContent = message;
        if (state) status.dataset.state = state;
        else delete status.dataset.state;
    }

    function resetStatus(modal = document.getElementById(REPORT_MODAL_ID)) {
        setStatus(modal);
    }

    function getPublicSourceUrl() {
        const sourceUrl = new URL(window.location.href);
        sourceUrl.search = '';
        sourceUrl.hash = '';
        return sourceUrl.toString();
    }

    function openReportModal(event) {
        const modal = ensureReportModal();
        const trigger = event?.currentTarget instanceof HTMLElement
            ? event.currentTarget
            : document.activeElement;
        const sourceUrl = modal.querySelector('#report-source-url');
        if (sourceUrl) sourceUrl.value = getPublicSourceUrl();
        resetStatus(modal);

        window.SiteDialog.open(modal, trigger);
    }

    function initReportModal() {
        ensureReportModal();
        document.querySelectorAll('.floating-report-btn').forEach((button) => {
            if (button.dataset.reportOpenBound === 'true') return;
            button.dataset.reportOpenBound = 'true';
            button.addEventListener('click', openReportModal);
        });
    }

    async function sendFeedbackToWorker(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const modal = form.closest('.modal-overlay');
        const submitButton = form.querySelector('[type="submit"]');

        if (!form.reportValidity()) {
            setStatus(modal, '필수 항목을 확인해 주세요.', 'error');
            return;
        }

        const endpoint = typeof CONFIG !== 'undefined'
            ? String(CONFIG.FEEDBACK_ENDPOINT_URL || '').trim()
            : '';
        if (!endpoint) {
            setStatus(modal, '제보 접수 주소가 설정되지 않았습니다.', 'error');
            return;
        }

        const formData = new FormData(form);
        const payload = {
            reporter: '익명',
            message: String(formData.get('message') || '').trim(),
            sourceUrl: String(formData.get('report_source_url') || getPublicSourceUrl()),
            pageTitle: document.title || '',
            submittedAt: new Date().toISOString()
        };

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);
        submitButton.disabled = true;
        submitButton.textContent = '전송 중…';
        setStatus(modal, '제보를 안전하게 전송하고 있습니다.', 'loading');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            if (!response.ok) {
                const detail = await response.json().catch(() => null);
                throw new Error(detail?.error || `HTTP ${response.status}`);
            }

            setStatus(modal, '제보가 접수되었습니다. 감사합니다.', 'success');
            form.reset();
        } catch (error) {
            const message = error.name === 'AbortError'
                ? '응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
                : '전송하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            console.error('제보 전송 실패:', error);
            setStatus(modal, message, 'error');
        } finally {
            window.clearTimeout(timeoutId);
            submitButton.disabled = false;
            submitButton.textContent = '제보 보내기';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReportModal, { once: true });
    } else {
        initReportModal();
    }

})();
