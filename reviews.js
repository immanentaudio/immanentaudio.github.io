/* Renders the reviews for whichever product page we're on.
 *
 * Markup contract: an empty <div data-reviews="de-esser"></div> somewhere on the
 * page. Everything else is built here from two files: /reviews/gumroad.json,
 * which the daily GitHub Action rewrites wholesale, and /reviews/manual.json,
 * for reviews from anywhere else - they have to live apart or the sync would
 * erase the hand-written ones. If a product has no written reviews yet the
 * whole block removes itself - an empty "Reviews" heading looks worse than
 * nothing at all.
 */
(function () {
    var mount = document.querySelector('[data-reviews]');
    if (!mount) return;

    var product = mount.getAttribute('data-reviews');

    // What the badge on a card says, and what it means.
    var SOURCES = {
        gumroad: { label: 'Gumroad', title: 'Verified purchase on Gumroad' },
        bpb: { label: 'Bedroom Producers Blog', title: 'Comment on Bedroom Producers Blog' }
    };

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

    // manual.json is allowed to be missing; gumroad.json isn't.
    function load(url, optional) {
        return fetch(url, { cache: 'no-cache' })
            .then(function (r) {
                if (r.ok) return r.json();
                if (optional) return {};
                return Promise.reject(r.status);
            })
            .catch(function (err) {
                if (optional) return {};
                return Promise.reject(err);
            });
    }

    Promise.all([load('/reviews/gumroad.json'), load('/reviews/manual.json', true)])
        .then(function (sets) {
            var reviews = sets.reduce(function (all, set) {
                return all.concat((set.reviews || []).filter(function (r) {
                    return r.product === product;
                }));
            }, []).sort(function (a, b) {
                return String(b.date || '').localeCompare(String(a.date || ''));
            });
            if (!reviews.length) { mount.remove(); return; }

            // The star average stays a Gumroad figure - nowhere else rates out of five.
            var agg = (sets[0].ratings || {})[product];
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
                var src = SOURCES[r.source] || { label: r.source || '', title: '' };
                var title = src.title ? ' title="' + esc(src.title) + '"' : '';

                // The badge links back to where the review was left, when we
                // know the address - a claim about a review should be checkable.
                var badge = r.url
                    ? '<a class="review-badge" href="' + esc(r.url) + '" target="_blank"' +
                          ' rel="noopener"' + title + '>' + esc(src.label) + '</a>'
                    : '<span class="review-badge"' + title + '>' + esc(src.label) + '</span>';

                var html =
                    '<article class="review-card">' +
                        '<div class="review-head">' +
                            // Not every source rates out of five; BPB comments don't.
                            (r.rating ? '<span class="review-stars">' + stars(r.rating) + '</span>' : '') +
                            badge +
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
        })
        .catch(function () { mount.remove(); });
})();
