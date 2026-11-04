// Adapter only: the catalog, filters and monster cards belong to dzone-info.js.
window.DzoneMonsterPicker.configure({onSelect:selection=>parent.postMessage({type:'scarecrow:enemy-selected',selection},location.origin)});
