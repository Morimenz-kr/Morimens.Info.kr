# 공통 토스트

`js/toast.js`와 `css/toast.css`는 보유현황의 기존 토스트 표시·모양을 공통으로 분리한 것이다. 보유현황, 파티 편성, 비밀계약 시뮬레이터가 함께 사용한다. 각 페이지에서 별도의 DOM 생성·타이머·토스트 스타일을 구현하지 않는다.

```js
window.MorimensToast.show('저장했습니다.');
window.MorimensToast.show('저장했습니다.', {type:'success'});
window.MorimensToast.show('오류가 발생했습니다.', {type:'error'});
window.MorimensToast.clear();
```

기본 표시 시간은 기존 보유현황과 같은2600ms다. 파티 편성의 호환 함수는 `{duration:2000, offset:80}`으로 기존 시간·위치를 유지한다. 연속 호출은 이전 토스트와 타이머를 제거한 뒤 새 안내 하나만 표시한다. 기본은 `role=status`, 오류 유형은 `role=alert`다.

열린 native dialog가 있으면 그 안에 표시하며 편집창 하단 버튼 위로 올린다. 포커스를 이동하지 않고 조작부와 겹치면 상단으로 위치를 바꾼다. 편집창을 닫으면 해당 토스트도 제거한다. 작은 화면·확대 글자에서 줄바꿈을 지원하고 reduced motion에서는 움직임을 제거한다.

ScareCrow 빌드와 보유현황 전용 Pages 패키지에도 두 공통 파일을 포함한다. 전체 사이트 Pages는 기존 디렉터리 복사 경로를 사용한다.

검증: `tools/test-shared-toast.mjs`에서 실제 설치 Chrome의 격리 프로필로 세 페이지와 각 빌드 결과물을 점검한다. 소스 세 페이지의320/390/768/1024/1280px, 가로844×390, 320/1280px 글자200%의24조건과 빌드 결과물 세 곳의390px를 확인했다. 실제 저장·안내 버튼, 교체·자동 제거, 포커스와 겹침, 보유현황 ‘저장 후 다음 캐릭터’의 모달 내부 안내를 확인했다. 증거는 `.generated/shared-toast-proof/`다. 모바일은 데스크톱 Chrome의 viewport 검사이며 실제 기기 검사는 아니다.
