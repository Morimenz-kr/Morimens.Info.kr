// 웹사이트 설정 파일
const CONFIG = {
    // 1. 패치노트와 맞출 버전 (배포 시 이 부분을 수정)
    VERSION: "v1.3.22",
    LAST_UPDATED: "2026-07-14",

    // 2. 피드백 접수용 Cloudflare Worker URL
    // 예: https://morimens-feedback.<your-subdomain>.workers.dev
    FEEDBACK_ENDPOINT_URL: 'https://carriepigeon.khj613401.workers.dev',

    // Google Analytics 4 측정 ID (웹 페이지에 공개되는 식별자)
    GA_MEASUREMENT_ID: 'G-8WVRT702E7'
};

// 공통 설정 파일을 사용하는 모든 페이지에서 Google Analytics를 한 번만 초기화합니다.
function loadGoogleAnalytics(measurementId) {
    if (!measurementId || window.__googleAnalyticsLoaded) return;

    window.__googleAnalyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
        window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());
    window.gtag('config', measurementId);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
}

loadGoogleAnalytics(CONFIG.GA_MEASUREMENT_ID);

// CSS를 버전 붙여서 로드하는 함수
function loadCSS(path) {
    document.write(`<link rel="stylesheet" href="${path}?v=${CONFIG.VERSION}">`);
}

// JS를 버전 붙여서 로드하는 함수
function loadJS(path) {
    // <\/script> 로 쓰는 이유는 자바스크립트 문자열 내에서 스크립트 태그 종료를 안전하게 처리하기 위함입니다.
    document.write(`<script src="${path}?v=${CONFIG.VERSION}"><\/script>`);
}
