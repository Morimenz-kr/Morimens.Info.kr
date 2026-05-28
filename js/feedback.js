(function () {
    async function sendFeedbackToWorker(event) {
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);
        const modalStatus = document.getElementById('modal-form-status');
        const modal = document.getElementById('report-modal');
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
                if (modal) modal.classList.remove('show');
                setFeedbackStatus(modalStatus, '전송 중...', '#ffc107', false);
            }, 1500);
        } catch (error) {
            console.error('제보 전송 실패:', error);
            setFeedbackStatus(modalStatus, '전송에 실패했습니다. 잠시 후 다시 시도해주세요.', '#e74c3c', true);
        }
    }

    function setFeedbackStatus(element, text, color, visible) {
        if (!element) return;
        element.style.display = visible ? 'block' : 'none';
        element.textContent = text;
        element.style.color = color;
    }

    window.sendFeedbackToWorker = sendFeedbackToWorker;
    window.sendToDiscord = sendFeedbackToWorker;
})();
