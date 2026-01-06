// 웹사이트 설정 파일
const CONFIG = {
    // 1. 패치노트와 맞출 버전 (배포 시 이 부분을 수정)
    VERSION: "v1.3.3",
    LAST_UPDATED: "2026-01-06",

    // 2. Discord Webhook URL - 기존 주소 유지
    DISCORD_WEBHOOK_URL: 'https://discordapp.com/api/webhooks/1442726767222718554/i3QtvZ6-giYqwtlheMm3ugxcJoVsoVYmExBPX2n-uEoFHpWwmGqaaO_f6gnlBNXCZYas'
};

// CSS를 버전 붙여서 로드하는 함수
function loadCSS(path) {
    document.write(`<link rel="stylesheet" href="${path}?v=${CONFIG.VERSION}">`);
}

// JS를 버전 붙여서 로드하는 함수
function loadJS(path) {
    // <\/script> 로 쓰는 이유는 자바스크립트 문자열 내에서 스크립트 태그 종료를 안전하게 처리하기 위함입니다.
    document.write(`<script src="${path}?v=${CONFIG.VERSION}"><\/script>`);
}