/* Lucashouse — shared behaviour for every page.
   Mobile-first: touch targets, swipe, and horizontal scrollers come first,
   pointer/keyboard behaviour is layered on top. */

(function () {
    'use strict';

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------
       Helpers
       ------------------------------------------------------------------ */

    function debounce(fn, wait) {
        var timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, wait);
        };
    }

    /* Bring an item of a horizontal scroller into view without ever moving
       the page vertically (scrollIntoView would). */
    function centerInScroller(scroller, el) {
        if (!scroller || !el) return;
        if (scroller.scrollWidth <= scroller.clientWidth + 1) return;

        var scrollerRect = scroller.getBoundingClientRect();
        var elRect = el.getBoundingClientRect();
        var target = scroller.scrollLeft + (elRect.left - scrollerRect.left) -
            (scroller.clientWidth - elRect.width) / 2;
        var max = scroller.scrollWidth - scroller.clientWidth;

        scroller.scrollTo({
            left: Math.max(0, Math.min(target, max)),
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
    }

    /* ------------------------------------------------------------------
       Primary nav — reveal the current page's tile in the swipeable strip
       ------------------------------------------------------------------ */

    function initPrimaryNav() {
        var nav = document.querySelector('.accordion-nav');
        if (!nav) return;
        var active = nav.querySelector('.nav-item.active');
        if (!active) return;

        // Jump (no animation) on first paint so the strip never appears to move.
        if (nav.scrollWidth > nav.clientWidth + 1) {
            var navRect = nav.getBoundingClientRect();
            var itemRect = active.getBoundingClientRect();
            nav.scrollLeft = Math.max(0, nav.scrollLeft + (itemRect.left - navRect.left) -
                (nav.clientWidth - itemRect.width) / 2);
        }
    }

    /* ------------------------------------------------------------------
       Secondary nav — scrollspy + keep the active chip visible
       ------------------------------------------------------------------ */

    function initScrollSpy() {
        var nav = document.querySelector('.secondary-nav');
        if (!nav) return;

        var entries = [].slice.call(nav.querySelectorAll('a[href^="#"]'))
            .map(function (link) {
                var id = decodeURIComponent(link.getAttribute('href').slice(1));
                return { link: link, section: id ? document.getElementById(id) : null };
            })
            .filter(function (entry) { return entry.section; });

        if (!entries.length) return;

        var container = nav.closest('.secondary-nav-container');
        var current = null;
        var ticking = false;

        function update() {
            ticking = false;

            var offset = (container ? container.getBoundingClientRect().height : 0) + 24;
            var match = null;

            entries.forEach(function (entry) {
                if (entry.section.getBoundingClientRect().top <= offset) match = entry;
            });

            // The last section is often too short to ever reach the offset line.
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
                match = entries[entries.length - 1];
            }

            if (match === current) return;
            current = match;

            entries.forEach(function (entry) {
                entry.link.classList.toggle('active', entry === match);
                if (entry === match) {
                    entry.link.setAttribute('aria-current', 'true');
                } else {
                    entry.link.removeAttribute('aria-current');
                }
            });

            if (match) centerInScroller(nav, match.link);
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }

        // Settle the reveal animation *before* the browser jumps to the anchor,
        // otherwise the target slides up behind the sticky bar afterwards.
        nav.addEventListener('click', function (event) {
            if (event.target.closest('a[href^="#"]')) revealAll();
        });

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        update();
    }

    /* ------------------------------------------------------------------
       Galleries — collapse to a fixed number of rows at any viewport
       ------------------------------------------------------------------ */

    var VISIBLE_ROWS = 2;

    function syncToggleLabel(grid, btn) {
        var collapsed = grid.classList.contains('collapsed');
        btn.textContent = collapsed ? 'Mostra di più' : 'Mostra di meno';
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    /* Measure where each row starts so the collapsed height follows the real
       grid (2 columns on phones, auto-fit columns on desktop) instead of a
       hard-coded pixel value. */
    function measureGallery(container) {
        var grid = container.querySelector('.gallery-grid');
        var btn = container.querySelector('.show-more-btn');
        if (!grid || !btn) return;

        var wasCollapsed = grid.classList.contains('collapsed');
        grid.classList.remove('collapsed');

        var items = [].slice.call(grid.children);
        var gridTop = grid.getBoundingClientRect().top;
        var rows = [];

        items.forEach(function (item) {
            var top = Math.round(item.getBoundingClientRect().top - gridTop);
            var isNewRow = rows.every(function (row) { return Math.abs(row - top) > 4; });
            if (isNewRow) rows.push(top);
        });
        rows.sort(function (a, b) { return a - b; });

        if (rows.length <= VISIBLE_ROWS) {
            // Everything fits — no toggle needed.
            btn.hidden = true;
            grid.style.removeProperty('--collapsed-height');
            return;
        }

        var rowGap = parseFloat(window.getComputedStyle(grid).rowGap) || 0;
        var collapsedHeight = Math.max(0, rows[VISIBLE_ROWS] - rowGap);

        grid.style.setProperty('--collapsed-height', collapsedHeight + 'px');
        btn.hidden = false;

        if (wasCollapsed) grid.classList.add('collapsed');
        syncToggleLabel(grid, btn);
    }

    function initGalleries() {
        [].slice.call(document.querySelectorAll('.gallery-container')).forEach(measureGallery);
    }

    /* Kept global: the markup calls it from an inline handler. */
    window.toggleGallery = function (galleryId, btn) {
        var grid = document.getElementById(galleryId);
        if (!grid) return;
        grid.classList.toggle('collapsed');
        syncToggleLabel(grid, btn);

        // Collapsing from far down the list would leave the user stranded.
        if (grid.classList.contains('collapsed')) {
            var top = grid.getBoundingClientRect().top + window.scrollY - 90;
            if (window.scrollY > top) {
                window.scrollTo({ top: top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            }
        }
    };

    /* ------------------------------------------------------------------
       Lightbox — one group per gallery, swipeable, keyboard accessible
       ------------------------------------------------------------------ */

    function initLightbox() {
        var lightbox = document.getElementById('lightbox');
        var lightboxImg = document.getElementById('lightbox-img');
        if (!lightbox || !lightboxImg) return;

        var counter = document.getElementById('lightbox-counter');
        var closeBtn = lightbox.querySelector('.close');
        var prevBtn = lightbox.querySelector('.prev');
        var nextBtn = lightbox.querySelector('.next');

        var group = [];
        var index = 0;
        var lastFocused = null;
        var savedScrollY = 0;

        function lockScroll() {
            savedScrollY = window.scrollY;
            document.body.style.top = -savedScrollY + 'px';
            document.body.classList.add('is-lightbox-open');
        }

        function unlockScroll() {
            document.body.classList.remove('is-lightbox-open');
            document.body.style.top = '';
            window.scrollTo(0, savedScrollY);
        }

        function render() {
            var img = group[index];
            if (!img) return;
            lightboxImg.src = img.currentSrc || img.src;
            lightboxImg.alt = img.alt || '';
            if (counter) counter.textContent = (index + 1) + ' / ' + group.length;
            lightbox.setAttribute('data-single', group.length < 2 ? 'true' : 'false');
        }

        function open(images, startIndex, trigger) {
            group = images;
            index = startIndex;
            lastFocused = trigger || null;
            render();
            lightbox.style.display = 'flex';
            lockScroll();
            if (closeBtn) closeBtn.focus();
        }

        function close() {
            lightbox.style.display = 'none';
            unlockScroll();
            if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
            lastFocused = null;
        }

        function move(step) {
            if (group.length < 2) return;
            index = (index + step + group.length) % group.length;
            render();
        }

        function isOpen() {
            return lightbox.style.display === 'flex';
        }

        // Wire every gallery: images become real buttons for keyboard users.
        [].slice.call(document.querySelectorAll('.gallery-grid')).forEach(function (grid) {
            var images = [].slice.call(grid.querySelectorAll('.gallery-img'));

            images.forEach(function (img, i) {
                img.setAttribute('role', 'button');
                img.setAttribute('tabindex', '0');
                if (!img.getAttribute('aria-label')) {
                    img.setAttribute('aria-label', 'Apri la foto' + (img.alt ? ': ' + img.alt : ''));
                }

                img.addEventListener('click', function () { open(images, i, img); });
                img.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                        event.preventDefault();
                        open(images, i, img);
                    }
                });
            });
        });

        if (closeBtn) closeBtn.addEventListener('click', close);
        if (prevBtn) prevBtn.addEventListener('click', function () { move(-1); });
        if (nextBtn) nextBtn.addEventListener('click', function () { move(1); });

        lightbox.addEventListener('click', function (event) {
            if (event.target === lightbox) close();
        });

        document.addEventListener('keydown', function (event) {
            if (!isOpen()) return;
            if (event.key === 'Escape') {
                close();
            } else if (event.key === 'ArrowLeft') {
                move(-1);
            } else if (event.key === 'ArrowRight') {
                move(1);
            } else if (event.key === 'Tab') {
                // Small focus trap so Tab cannot wander behind the overlay.
                var focusable = [closeBtn, prevBtn, nextBtn].filter(function (el) {
                    return el && el.offsetParent !== null;
                });
                if (!focusable.length) return;
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });

        // Swipe between photos on touch devices.
        var startX = 0;
        var startY = 0;
        var startTime = 0;
        var tracking = false;

        lightbox.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1) { tracking = false; return; }
            tracking = true;
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });

        lightbox.addEventListener('touchend', function (event) {
            if (!tracking) return;
            tracking = false;

            var touch = event.changedTouches[0];
            var dx = touch.clientX - startX;
            var dy = touch.clientY - startY;

            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - startTime < 800) {
                move(dx < 0 ? 1 : -1);
            } else if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx) * 1.4) {
                close(); // swipe away to dismiss
            }
        }, { passive: true });

        // Legacy inline handlers, kept working just in case.
        window.closeLightbox = close;
        window.changeSlide = move;
    }

    /* ------------------------------------------------------------------
       Map — inert until tapped, so a vertical drag scrolls the page
       ------------------------------------------------------------------ */

    function initMapShield() {
        var shield = document.querySelector('.map-shield');
        if (!shield) return;
        shield.addEventListener('click', function () { shield.hidden = true; });
    }

    /* ------------------------------------------------------------------
       Reveal on scroll — skip anything already on screen so the first
       paint is instant on mobile
       ------------------------------------------------------------------ */

    /* Reveals every pending section at once. The animation offsets each
       section by 24px, so anchor navigation would otherwise land on a target
       that then slides up behind the sticky nav. */
    var revealAll = function () { };

    function initReveal() {
        var targets = [].slice.call(
            document.querySelectorAll('main > section, .page-section, .footer-grid')
        );

        if (!('IntersectionObserver' in window) || prefersReducedMotion || !targets.length) return;

        // Landing straight on an anchor: show everything, no animation to fight.
        if (window.location.hash && document.getElementById(window.location.hash.slice(1))) return;

        var below = targets.filter(function (el) {
            return el.getBoundingClientRect().top > window.innerHeight * 0.9;
        });
        if (!below.length) return;

        below.forEach(function (el) { el.classList.add('reveal'); });

        var observer = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        below.forEach(function (el) { observer.observe(el); });

        revealAll = function () {
            below.forEach(function (el) {
                observer.unobserve(el);
                el.classList.remove('reveal');
                el.classList.add('is-visible');
            });
            revealAll = function () { };
        };
    }

    /* ------------------------------------------------------------------
       Boot
       ------------------------------------------------------------------ */

    function onReady() {
        initPrimaryNav();
        initScrollSpy();
        initLightbox();
        initGalleries();
        initMapShield();
        initReveal();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }

    // Images and web fonts settle after DOMContentLoaded and can change row heights.
    window.addEventListener('load', initGalleries);
    window.addEventListener('resize', debounce(function () {
        initPrimaryNav();
        initGalleries();
    }, 150));
    window.addEventListener('orientationchange', debounce(initGalleries, 250));
}());
