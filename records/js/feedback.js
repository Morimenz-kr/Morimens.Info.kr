(function () {
    const REPORT_MODAL_ID = 'report-modal';

    function ensureReportModal() {
        let modal = document.getElementById(REPORT_MODAL_ID);
        if (modal) return modal;

        document.body.insertAdjacentHTML('beforeend', `
<div id="report-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
    <div class="modal-content report-modal-content">
        <button type="button" class="close-btn report-modal-close" data-report-close aria-label="닫기">
            &times;
        </button>

        <h2 id="report-modal-title" class="form-title">버그 제보 or 피드백</h2>
        <p class="report-modal-description">제보하실 내용을 적어주세요. 개발자에게 즉시 알림이 전송됩니다.</p>

        <form id="bug-report-form" action="javascript:void(0);" method="POST">
            <label for="reporter-email" class="form-field-label">패치노트에 올라갈 닉네임 (선택)</label>
            <input type="text" id="reporter-email" name="_replyto" class="form-input"
                   placeholder="패치노트에 언급을 원하시면 적어주세요">

            <label for="report-message" class="form-field-label">
                제보할 내용 (버그 or 피드백) (필수)
                <span class="report-modal-help">
                    특정 게시글/정보 관련 제보라면, <u>해당 글의 링크</u>를 본문에 꼭 적어주세요.
                </span>
            </label>
            <textarea id="report-message" name="message" class="form-textarea" required
                      placeholder="내용을 입력해주세요."></textarea>

            <input type="hidden" name="report_source_url" id="report-source-url">
            <button type="submit" class="form-submit-btn">제보 보내기</button>
            <p id="modal-form-status" class="report-modal-status">전송 중...</p>
        </form>
    </div>
</div>`);

        modal = document.getElementById(REPORT_MODAL_ID);
        modal.querySelector('[data-report-close]')?.addEventListener('click', closeReportModal);
        modal.querySelector('#bug-report-form')?.addEventListener('submit', sendFeedbackToWorker);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeReportModal();
        });
        return modal;
    }

    function setFeedbackStatus(element, text, color, visible) {
        if (!element) return;
        element.style.display = visible ? 'block' : 'none';
        element.textContent = text;
        element.style.color = color;
    }

    function resetReportModalStatus() {
        const modalStatus = document.getElementById('modal-form-status');
        setFeedbackStatus(modalStatus, '전송 중...', '#ffc107', false);
    }

    function openReportModal() {
        const modal = ensureReportModal();
        const sourceUrlInput = document.getElementById('report-source-url');

        resetReportModalStatus();
        if (sourceUrlInput) sourceUrlInput.value = window.location.href;
        modal.style.display = '';
        modal.classList.add('show');
    }

    function closeReportModal() {
        const modal = document.getElementById(REPORT_MODAL_ID);
        if (!modal) return;

        modal.classList.remove('show');
        modal.style.display = '';
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

        const form = event.target;
        const formData = new FormData(form);
        const modalStatus = document.getElementById('modal-form-status');
        const endpoint = (typeof CONFIG !== 'undefined') ? CONFIG.FEEDBACK_ENDPOINT_URL : '';

        setFeedbackStatus(modalStatus, '제보를 전송 중입니다...', '#ffc107', true);

        if (!endpoint || !endpoint.trim()) {
            setFeedbackStatus(modalStatus, '설정 오류: 피드백 접수 주소가 없습니다.', '#e74c3c', true);
            return;
        }

        const payload = {
            reporter: formData.get('_replyto') || '익명(Anonymous)',
            message: formData.get('message') || '',
            sourceUrl: formData.get('report_source_url') || window.location.href,
            pageTitle: document.title || '',
            userAgent: navigator.userAgent || '',
            submittedAt: new Date().toISOString()
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            setFeedbackStatus(modalStatus, '전송 완료! 감사합니다.', '#2ecc71', true);
            form.reset();
            setTimeout(() => {
                closeReportModal();
                resetReportModalStatus();
            }, 1500);
        } catch (error) {
            console.error('제보 전송 실패:', error);
            setFeedbackStatus(modalStatus, '전송에 실패했습니다. 잠시 후 다시 시도해주세요.', '#e74c3c', true);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReportModal);
    } else {
        initReportModal();
    }

    window.openReportModal = openReportModal;
    window.closeReportModal = closeReportModal;
    window.sendFeedbackToWorker = sendFeedbackToWorker;
    window.sendToDiscord = sendFeedbackToWorker;
})();
