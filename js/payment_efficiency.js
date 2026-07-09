(function () {
    const image = document.getElementById('efficiency-image');
    const level = document.getElementById('zoom-level');
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const reset = document.getElementById('zoom-reset');
    let zoom = 1;

    function applyZoom() {
        image.style.width = `${zoom * 100}%`;
        level.value = `${Math.round(zoom * 100)}%`;
        level.textContent = level.value;
        zoomOut.disabled = zoom <= 0.5;
        zoomIn.disabled = zoom >= 3;
    }

    zoomIn.addEventListener('click', () => {
        zoom = Math.min(3, zoom + 0.25);
        applyZoom();
    });
    zoomOut.addEventListener('click', () => {
        zoom = Math.max(0.5, zoom - 0.25);
        applyZoom();
    });
    reset.addEventListener('click', () => {
        zoom = 1;
        applyZoom();
    });
    applyZoom();
})();
