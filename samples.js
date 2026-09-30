/* Audio sample player for product pages.
 *
 * Markup contract: a [data-samples] block holding an <ol class="sample-list">
 * of <li><a href="clip.m4a">Name</a> <span class="sample-time">0:19</span></li>.
 * Without JS those are plain links the browser can play. With it, each row
 * becomes a play/pause button, a seek bar and a running time. One shared
 * <audio> element means only one clip ever plays at a time, and nothing is
 * downloaded until someone presses play.
 */
(function () {
    var root = document.querySelector('[data-samples]');
    if (!root) return;

    var PLAY = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" fill="currentColor"/></svg>';
    var PAUSE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><rect x="3.5" y="2.5" width="3.2" height="11" rx=".8" fill="currentColor"/><rect x="9.3" y="2.5" width="3.2" height="11" rx=".8" fill="currentColor"/></svg>';

    var audio = new Audio();
    audio.preload = 'none';
    var current = null;

    function fmt(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        var s = Math.floor(sec);
        return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }

    var rows = Array.prototype.map.call(root.querySelectorAll('.sample-list li'), function (li) {
        var link = li.querySelector('a');
        var time = li.querySelector('.sample-time');
        var name = link.textContent;
        var total = time ? time.textContent : '';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sample-play';
        btn.innerHTML = PLAY;
        btn.setAttribute('aria-label', 'Play ' + name);

        var label = document.createElement('span');
        label.className = 'sample-name';
        label.textContent = name;

        var seek = document.createElement('input');
        seek.type = 'range';
        seek.className = 'sample-seek';
        seek.min = 0;
        seek.max = 1000;
        seek.step = 1;
        seek.value = 0;
        seek.setAttribute('aria-label', name + ' position');

        li.textContent = '';
        li.className = 'sample';
        li.appendChild(btn);
        li.appendChild(label);
        li.appendChild(seek);
        if (time) li.appendChild(time);

        var row = { li: li, btn: btn, seek: seek, time: time, total: total, src: link.getAttribute('href'), name: name };

        btn.addEventListener('click', function () { toggle(row); });
        label.addEventListener('click', function () { toggle(row); });

        seek.addEventListener('input', function () {
            if (current !== row) {
                select(row);
                audio.addEventListener('loadedmetadata', function once() {
                    audio.removeEventListener('loadedmetadata', once);
                    audio.currentTime = audio.duration * seek.value / 1000;
                    audio.play();
                });
                audio.load();
                return;
            }
            if (isFinite(audio.duration)) audio.currentTime = audio.duration * seek.value / 1000;
        });

        return row;
    });

    function paint(row, playing) {
        row.btn.innerHTML = playing ? PAUSE : PLAY;
        row.btn.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + row.name);
        row.li.classList.toggle('is-playing', playing);
    }

    function reset(row) {
        paint(row, false);
        row.li.classList.remove('is-active');
        row.seek.value = 0;
        row.seek.style.setProperty('--fill', '0%');
        if (row.time) row.time.textContent = row.total;
    }

    function select(row) {
        if (current) { audio.pause(); reset(current); }
        current = row;
        row.li.classList.add('is-active');
        audio.src = row.src;
    }

    function toggle(row) {
        if (current !== row) {
            select(row);
            audio.play();
        } else if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    }

    audio.addEventListener('play', function () { if (current) paint(current, true); });
    audio.addEventListener('pause', function () { if (current) paint(current, false); });

    audio.addEventListener('timeupdate', function () {
        if (!current || !isFinite(audio.duration)) return;
        var pct = audio.currentTime / audio.duration;
        current.seek.value = Math.round(pct * 1000);
        current.seek.style.setProperty('--fill', (pct * 100) + '%');
        if (current.time) current.time.textContent = fmt(audio.currentTime);
    });

    // Run into the next clip, so pressing play once plays the whole set.
    audio.addEventListener('ended', function () {
        var i = rows.indexOf(current);
        reset(current);
        current = null;
        if (i > -1 && i < rows.length - 1) {
            select(rows[i + 1]);
            audio.play();
        }
    });

    root.classList.add('is-ready');
})();
