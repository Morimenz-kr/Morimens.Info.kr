/* js/landing.js - 랜딩 페이지 캐러셀, 패치노트, 제보 모달 로직 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 배너 슬라이더 로직 ---
    const track = document.getElementById('banner-track');
    const originalSlides = Array.from(track.children);
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const dotsContainer = document.getElementById('dots-container');

    const slideCount = originalSlides.length;
    let currentIndex = 1;
    let autoSlideInterval;
    let isTransitioning = false;

    const firstClone = originalSlides[0].cloneNode(true);
    const lastClone = originalSlides[slideCount - 1].cloneNode(true);

    track.appendChild(firstClone);
    track.insertBefore(lastClone, originalSlides[0]);

    track.style.transform = `translateX(-100%)`;

    originalSlides.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        if (idx === 0) dot.classList.add('active');
        dot.addEventListener('click', () => {
            resetTimer();
            moveToSlide(idx + 1);
        });
        dotsContainer.appendChild(dot);
    });
    const dots = Array.from(dotsContainer.children);

    function updateDots(index) {
        let realIndex = index - 1;
        if (realIndex < 0) realIndex = slideCount - 1;
        if (realIndex >= slideCount) realIndex = 0;

        dots.forEach(d => d.classList.remove('active'));
        dots[realIndex].classList.add('active');
    }

    function moveToSlide(index) {
        if (isTransitioning) return;
        isTransitioning = true;

        track.style.transition = 'transform 0.5s ease-in-out';
        track.style.transform = `translateX(-${index * 100}%)`;
        currentIndex = index;
        updateDots(currentIndex);
    }

    track.addEventListener('transitionend', () => {
        isTransitioning = false;
        if (currentIndex === slideCount + 1) {
            track.style.transition = 'none';
            currentIndex = 1;
            track.style.transform = `translateX(-100%)`;
        }
        if (currentIndex === 0) {
            track.style.transition = 'none';
            currentIndex = slideCount;
            track.style.transform = `translateX(-${slideCount * 100}%)`;
        }
    });

    function resetTimer() {
        clearInterval(autoSlideInterval);
        autoSlideInterval = setInterval(() => moveToSlide(currentIndex + 1), 5000);
    }

    nextBtn.addEventListener('click', () => {
        resetTimer();
        moveToSlide(currentIndex + 1);
    });

    prevBtn.addEventListener('click', () => {
        resetTimer();
        moveToSlide(currentIndex - 1);
    });

    resetTimer();

    const bannerContainer = document.querySelector('.banner-container');
    bannerContainer.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
    bannerContainer.addEventListener('mouseleave', () => resetTimer());


    // --- 패치노트 로직 ---
    const modal = document.getElementById('patch-modal');
    const openBtn = document.getElementById('open-patch-modal');
    const closeBtn = document.getElementById('close-patch-modal');
    const listContent = document.getElementById('patch-list-content');

    async function loadPatchNotes() {
        try {
            const ts = new Date().getTime();
            const res = await fetch(`data/patch_notes.json?t=${ts}`);
            if (!res.ok) throw new Error('Load failed');
            const data = await res.json();
            let html = '';
            data.forEach(item => {
                let changesHtml = item.changes.map(c => `<li>${c}</li>`).join('');
                html += `<div class="patch-item"><span class="patch-ver">${item.version}</span><span class="patch-date">${item.date}</span><ul class="patch-desc">${changesHtml}</ul></div><hr style="border-color:#333; opacity:0.5;">`;
            });
            listContent.innerHTML = html.replace(/\<hr[^\>]*\>(?=[^\<]*$)/, '');

            if (data.length > 0) {
                openBtn.textContent = `Patch Notes ${data[0].version}`;
            }
        } catch (e) { listContent.innerHTML = '로드 실패'; }
    }

    loadPatchNotes();

    openBtn.addEventListener('click', () => { modal.classList.add('show'); });
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

    // 모달 닫기 이벤트 리스너 바인딩
    const reportModal = document.getElementById('report-modal');
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) {
                reportModal.classList.remove('show');
            }
        });
    }
});

// --- 신고 모달 함수 ---
function openReportModal() {
    const modal = document.getElementById('report-modal');
    const modalStatus = document.getElementById('modal-form-status');
    const sourceUrlInput = document.getElementById('report-source-url');

    if (modalStatus) {
        modalStatus.style.display = 'none';
        modalStatus.textContent = '제보를 전송 중입니다...';
        modalStatus.style.color = '#ffc107';
    }

    if (sourceUrlInput) {
        sourceUrlInput.value = window.location.href;
    }

    modal.classList.add('show');
}

async function sendToDiscord(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const modalStatus = document.getElementById('modal-form-status');
    const modal = document.getElementById('report-modal');

    if (modalStatus) {
        modalStatus.style.display = 'block';
        modalStatus.textContent = '제보를 전송 중입니다...';
        modalStatus.style.color = '#ffc107';
    }

    const reporterEmail = formData.get('_replyto') || '익명(Anonymous)';
    const message = formData.get('message');
    const sourceUrl = formData.get('report_source_url') || window.location.href;

    const payload = {
        username: "Morimens Wiki Bot",
        embeds: [{
            title: "새로운 제보가 도착했습니다!",
            description: "위키에서 유저 피드백/버그 제보가 접수되었습니다.",
            color: 0xFF9F43,
            fields: [
                { name: "제보자", value: `\`${reporterEmail}\``, inline: true },
                { name: "발생 페이지", value: `[바로가기(Click)](${sourceUrl})`, inline: true },
                { name: "상세 내용", value: `>>> ${message}`, inline: false }
            ],
            footer: { text: "Morimens Wiki Report System" },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const webhookUrl = (typeof CONFIG !== 'undefined') ? CONFIG.DISCORD_WEBHOOK_URL : '';
        if(!webhookUrl) throw new Error("Config Error");

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (modalStatus) {
            modalStatus.textContent = "전송 완료! 감사합니다.";
            modalStatus.style.color = "#2ecc71";
        }
        form.reset();
        setTimeout(() => {
            modal.classList.remove('show');
            if (modalStatus) {
                modalStatus.style.display = 'none';
                modalStatus.textContent = '제보를 전송 중입니다...';
                modalStatus.style.color = '#ffc107';
            }
        }, 1500);
    } catch (error) {
        console.error(error);
        if (modalStatus) {
            modalStatus.textContent = '설정 오류 또는 네트워크 오류입니다.';
            modalStatus.style.color = "#e74c3c";
        }
    }
}
