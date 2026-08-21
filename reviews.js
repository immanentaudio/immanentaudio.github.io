/* Renders the Gumroad reviews for whichever product page we're on.
 *
 * Markup contract: an empty <div data-reviews="de-esser"></div> somewhere on the
 * page. Everything else is built here from /reviews/gumroad.json, which the
 * daily GitHub Action refreshes. If a product has no written reviews yet the
 * whole block removes itself - an empty "Reviews" heading looks worse than
 * nothing at all.
 */
(function () {
    var mount = document.querySelector('[data-reviews]');
    if (!mount) return;

    var product = mount.getAttribute('data-reviews');

    function stars(n) {
        var full = Math.round(n || 0), out = '';
        for (var i = 1; i <= 5; i++) {
            out += '<span class="review-star' + (i <= full ? '' : ' is-empty') + '">★</span>';
        }
        return out;
    }

    function when(iso) {
        var d = new Date(iso);
        if (isNaN(d)) return '';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function esc(s) {
        var n = document.createElement('div');
        n.textContent = s == null ? '' : String(s);
        return n.innerHTML;
    }

    fetch('/reviews/gumroad.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
            var reviews = (data.reviews || []).filter(function (r) {
                return r.product === product;
            });
            if (!reviews.length) { mount.remove(); return; }

            var agg = (data.ratings || {})[product];
            var head = '<h2>What people are saying</h2>';

            if (agg && agg.count) {
                head +=
                    '<div class="review-summary">' +
                        '<span class="review-stars">' + stars(agg.average) + '</span>' +
                        '<span class="review-average">' + agg.average.toFixed(1) + '</span>' +
                        '<span class="review-count">' + agg.count +
                            (agg.count === 1 ? ' rating' : ' ratings') + ' on Gumroad</span>' +
                    '</div>';
            }

            var cards = reviews.map(function (r) {
                var html =
                    '<article class="review-card">' +
                        '<div class="review-head">' +
                            '<span class="review-stars">' + stars(r.rating) + '</span>' +
                            '<span class="review-badge" title="Verified purchase on Gumroad">Gumroad</span>' +
                            (r.date ? '<time class="review-date" datetime="' + esc(r.date) + '">' +
                                esc(when(r.date)) + '</time>' : '') +
                        '</div>' +
                        '<p class="review-body">' + esc(r.message) + '</p>';

                if (r.response) {
                    html += '<div class="review-reply">' +
                                '<span class="review-reply-label">Immanent Audio</span>' +
                                '<p>' + esc(r.response) + '</p>' +
                            '</div>';
                }
                return html + '</article>';
            }).join('');

            mount.innerHTML = head +
                '<div class="review-scroll"><div class="review-list">' + cards + '</div></div>';
            mount.classList.add('is-loaded');

            // Clamp anything long enough to crowd out the reviews under it.
            // Only bothers when the text actually overflows its 5 lines.
            mount.querySelectorAll('.review-body').forEach(function (body) {
                body.classList.add('is-clamped');
                if (body.scrollHeight <= body.clientHeight + 2) {
                    body.classList.remove('is-clamped');
                    return;
                }
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'review-more';
                btn.textContent = 'Read more';
                btn.setAttribute('aria-expanded', 'false');
                btn.addEventListener('click', function () {
                    var open = body.classList.toggle('is-clamped');
                    btn.textContent = open ? 'Read more' : 'Show less';
                    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
                });
                body.insertAdjacentElement('afterend', btn);
            });

            sizeScroller(mount);

            // Fonts, the sidebar screenshot and window resizes all change how
            // much room is left for the list, so re-measure whenever the
            // sidebar's box changes rather than guessing when that settles.
            var sidebar = mount.closest('.sidebar-sticky');
            if (sidebar && window.ResizeObserver) {
                new ResizeObserver(function () { sizeScroller(mount); }).observe(sidebar);
            }
            var timer;
            window.addEventListener('resize', function () {
                clearTimeout(timer);
                timer = setTimeout(function () { sizeScroller(mount); }, 120);
            });
        })
        .catch(function () { mount.remove(); });

    /* The list scrolls through every review; this only decides how much of it
       shows before you scroll. It takes all the room the sidebar has left,
       then backs off just enough that the cut lands part-way down a card
       rather than on a tidy card edge - a half-finished review is what tells
       you the list keeps going.

       Everything here is measured with offsetTop and the sidebar's max-height
       rather than live viewport rects, so re-running it while the list is
       scrolled (or already clipped) gives the same answer. */
    function sizeScroller(mount) {
        var scroll = mount.querySelector('.review-scroll');
        var list = mount.querySelector('.review-list');
        var sidebar = mount.closest('.sidebar-sticky');
        if (!scroll || !list || !sidebar) return;

        var style = getComputedStyle(sidebar);
        var cap = parseFloat(style.maxHeight);  // NaN under 768px, where nothing is capped
        var natural = list.scrollHeight;
        var top = list.offsetTop + scroll.offsetTop;
        var avail = cap - top - (parseFloat(style.paddingBottom) || 0);

        var height = 0;
        if (cap && natural > avail && avail > 120) {
            height = Math.round(avail);

            // Find the card the cut lands in and make sure enough of it shows
            // to read as an interrupted review. Nothing is dropped either way -
            // this is the height of the window, not of the list.
            var cards = list.children;
            for (var i = 0; i < cards.length; i++) {
                var top = cards[i].offsetTop - list.offsetTop;
                var bottom = top + cards[i].offsetHeight;
                if (bottom <= height) continue;
                var slice = Math.min(cards[i].offsetHeight * 0.45, 40);
                if (height - top < slice) height = Math.round(top + slice);
                break;
            }
        }

        // Re-running on our own resize would otherwise loop forever.
        var sig = cap + ':' + top + ':' + natural + ':' + height;
        if (sig === scroll.dataset.sig) return;
        scroll.dataset.sig = sig;

        if (!height) {
            scroll.style.maxHeight = '';
            scroll.classList.remove('is-scrollable', 'is-end');
            scroll.removeAttribute('tabindex');
            scroll.removeAttribute('role');
            scroll.removeAttribute('aria-label');
            return;
        }

        scroll.style.maxHeight = height + 'px';
        scroll.classList.add('is-scrollable');
        scroll.setAttribute('tabindex', '0');
        scroll.setAttribute('role', 'group');
        scroll.setAttribute('aria-label', 'Reviews, scroll for more');

        // Drop the fade once there's nothing left below it.
        if (!scroll.dataset.fadeBound) {
            scroll.dataset.fadeBound = '1';
            scroll.addEventListener('scroll', function () {
                scroll.classList.toggle('is-end',
                    scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2);
            });
        }
    }
})();
