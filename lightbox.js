/* ==============================================================
   IMMANENT AUDIO — screenshot lightbox
   Any <img class="plugin-screenshot"> inside a product sidebar card
   becomes a click-to-enlarge button. Progressive enhancement: with
   JS off the page is exactly as it was.
   ============================================================== */
(function () {
    var shots = document.querySelectorAll('.sidebar-card .plugin-screenshot');
    if (!shots.length) return;

    // Overlay — built once, reused for every screenshot on the page.
    var overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');

    // The image lives in its own scroller so the close button, which sits in
    // the overlay itself, never drifts off with a panned image.
    var scroller = document.createElement('div');
    scroller.className = 'lightbox-scroll';

    var full = document.createElement('img');

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'lightbox-close';
    close.setAttribute('aria-label', 'Close image');
    close.innerHTML = '&times;';

    function centre() {
        if (overlay.classList.contains('pannable')) {
            scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
        }
    }

    // Re-centre once the full-size file has actually loaded.
    full.addEventListener('load', centre);

    scroller.appendChild(full);
    overlay.appendChild(scroller);
    overlay.appendChild(close);
    document.body.appendChild(overlay);

    var lastTrigger = null;
    var NARROW = 700;   // below this, fit-to-screen isn't big enough to read

    function open(img) {
        lastTrigger = img.closest('.zoomable');
        full.src = img.currentSrc || img.src;
        full.alt = img.alt;

        var native = img.naturalWidth || 0;
        var vw = window.innerWidth || document.documentElement.clientWidth || 0;

        if (native && vw && vw < NARROW && native > vw) {
            // Phones: show the image well past screen width and let the user
            // scroll around it, rather than shrinking it back down to unreadable.
            overlay.classList.add('pannable');
            full.style.maxWidth = 'none';
            full.style.width = Math.min(native, vw * 2.5) + 'px';
        } else {
            // Never blow a small source up past its native size — it just goes soft.
            overlay.classList.remove('pannable');
            full.style.width = '';
            full.style.maxWidth = native ? 'min(' + native + 'px, 100%)' : '';
        }

        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        close.focus();

        // Start centred on the image when it's wider than the screen.
        centre();
    }

    function hide() {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastTrigger) lastTrigger.focus();
    }

    // Wrap each screenshot in a real button so keyboard users get it too.
    Array.prototype.forEach.call(shots, function (img) {
        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'zoomable';
        trigger.setAttribute('aria-label', 'Enlarge image: ' + img.alt);

        img.parentNode.insertBefore(trigger, img);
        trigger.appendChild(img);

        var hint = document.createElement('span');
        hint.className = 'zoom-hint';
        hint.textContent = window.matchMedia('(hover: none)').matches
            ? 'Tap to enlarge'
            : 'Click to enlarge';
        trigger.appendChild(hint);

        trigger.addEventListener('click', function () { open(img); });
    });

    // Clicking the backdrop (but not the image itself) closes.
    overlay.addEventListener('click', function (e) {
        if (e.target !== full) hide();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) hide();
    });
}());
