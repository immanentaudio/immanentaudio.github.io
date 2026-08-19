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
                            '<span class="review-name">' + esc(r.name) + '</span>' +
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

            mount.innerHTML = head + '<div class="review-list">' + cards + '</div>';
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
        })
        .catch(function () { mount.remove(); });
})();
