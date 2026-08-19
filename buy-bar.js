/* Mobile-only sticky purchase bar.
 *
 * On phones the two-column layout collapses and the purchase card lands near
 * the bottom of a long page, so the buy button is easy to never reach. This
 * pins a compact price + CTA to the bottom of the viewport instead, and gets
 * out of the way whenever the real card is actually on screen.
 *
 * Everything is cloned from the existing .sidebar-card, so the four product
 * pages stay in sync without any per-page markup.
 */
(function () {
    var card = document.querySelector('.sidebar-card');
    if (!card) return;

    var price = card.querySelector('.sidebar-price');
    var cta = card.querySelector('.cta-button');
    if (!price || !cta) return;

    var mq = window.matchMedia('(max-width: 767px)');
    var bar = null;

    function build() {
        if (bar) return;

        bar = document.createElement('div');
        bar.className = 'buy-bar';
        bar.setAttribute('aria-hidden', 'true');

        // Just the number - the "One-time purchase" label is noise down here.
        var label = price.cloneNode(true);
        var small = label.querySelector('small');
        if (small) small.remove();

        var text = document.createElement('span');
        text.className = 'buy-bar-price';
        text.textContent = (label.textContent || '').trim();

        var link = cta.cloneNode(true);
        link.className = 'cta-button';

        bar.appendChild(text);
        bar.appendChild(link);

        // Shown by default rather than animated in on load: a rAF/timeout
        // reveal never fires while the tab is backgrounded, which would leave
        // the bar stuck off-screen. Start in the right state instead.
        var box = card.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
            bar.classList.add('is-hidden');
        }

        document.body.appendChild(bar);
        document.body.classList.add('has-buy-bar');

        // Two buttons on screen at once just looks like a mistake, so stand
        // down while the genuine card is in view. A scroll listener rather
        // than IntersectionObserver: IO is driven by the rendering loop and
        // goes quiet in a backgrounded tab, which would strand the bar in
        // whichever state it was last in.
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update, { passive: true });
        update();
    }

    function update() {
        if (!bar) return;
        var box = card.getBoundingClientRect();
        // Ignore the last 80px of the viewport - that strip is the bar itself.
        var showing = box.top < window.innerHeight - 80 && box.bottom > 40;
        bar.classList.toggle('is-hidden', showing);
    }

    function teardown() {
        if (!bar) return;
        window.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
        bar.remove();
        bar = null;
        document.body.classList.remove('has-buy-bar');
    }

    function sync() { mq.matches ? build() : teardown(); }

    sync();
    mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync);
})();
