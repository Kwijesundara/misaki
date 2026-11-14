/* Misaki Japanese Academy — interactions
   Loading screen, language switch, mobile menu, scroll reveals, timeline progress,
   parallax, gallery (self-changing tiles, more photos, lightbox).
   No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---------- Loading screen: doors open once the page has loaded ---------- */
  (function loader() {
    var el = $('#loader');
    if (!el) return;
    var started = Date.now(), finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      // keep it up long enough for the sun and enso to finish drawing
      var wait = reduceMotion ? 0 : Math.max(0, 1700 - (Date.now() - started));
      setTimeout(function () {
        el.classList.add('is-done');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1300);
      }, wait);
    }
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish);
    setTimeout(finish, 4500); // never wait longer than this on a slow connection
  })();

  /* ---------- Language ---------- */
  function setLang(lang) {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    try { localStorage.setItem('misaki-lang', lang); } catch (e) {}
    $$('.lang__btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang));
    });
  }
  $$('.lang__btn').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-set-lang')); });
  });
  setLang(root.getAttribute('data-lang') || 'en');

  /* ---------- Header, mobile menu, back-to-top ---------- */
  var burger = $('#burger');
  var totop = $('#totop');

  function closeMenu() {
    document.body.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
  }
  burger.addEventListener('click', function () {
    var open = !document.body.classList.contains('nav-open');
    document.body.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('#nav a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---------- Scroll reveal ---------- */
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = (parseInt(el.getAttribute('data-delay'), 10) || 0) * 120;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-in');
        // Drop the stagger once revealed so hover effects respond immediately.
        setTimeout(function () { el.style.transitionDelay = ''; }, delay + 1100);
        io.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Scroll-driven: header state, parallax, timeline, nav highlight ---------- */
  var parallaxEls = $$('[data-parallax]');
  var timeline = $('#timeline');
  var steps = timeline ? $$('.step', timeline) : [];
  var navLinks = $$('#nav a[href^="#"]');
  var sections = navLinks.map(function (a) { return $(a.getAttribute('href')); });
  var ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    var vh = window.innerHeight;

    totop.classList.toggle('is-on', y > vh * 0.9);

    if (!reduceMotion && window.innerWidth > 640) {
      parallaxEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0;
        var offset = (r.top + r.height / 2 - vh / 2) * speed;
        el.style.translate = '0 ' + offset.toFixed(1) + 'px';
      });
    }

    if (timeline) {
      var tr = timeline.getBoundingClientRect();
      var mark = vh * 0.62;
      var p = Math.max(0, Math.min(1, (mark - tr.top) / Math.max(tr.height - 72, 1)));
      timeline.style.setProperty('--p', p.toFixed(3));
      steps.forEach(function (s) {
        s.classList.toggle('is-active', s.getBoundingClientRect().top < mark);
      });
    }

    var current = -1;
    sections.forEach(function (sec, i) {
      if (sec && sec.getBoundingClientRect().top < vh * 0.4) current = i;
    });
    navLinks.forEach(function (a, i) { a.classList.toggle('is-current', i === current); });
  }
  function requestScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll);
  onScroll();

  /* ---------- Gallery: photo list, lightbox, tiles that change on their own ---------- */
  (function gallery() {
    var box = $('#lightbox');
    var img = $('#lbImg');
    var cap = $('#lbCap');
    var tiles = $$('#g3 .gitem');
    var allItems = $$('.gitem');
    if (!box || !allItems.length) return;

    // Each tile lists the photos it cycles through; together they make the full set.
    var sets = tiles.map(function (t) {
      try { return JSON.parse(t.getAttribute('data-photos')) || []; } catch (e) { return []; }
    });
    var photos = [];
    function addPhoto(p) {
      if (p && p.src && !photos.some(function (q) { return q.src === p.src; })) photos.push(p);
    }
    sets.forEach(function (set) { set.forEach(addPhoto); });
    allItems.forEach(function (it) {
      addPhoto({ src: it.getAttribute('data-full'), en: it.getAttribute('data-cap-en'), ja: it.getAttribute('data-cap-ja') });
    });
    photos.sort(function (x, y) { return x.src < y.src ? -1 : x.src > y.src ? 1 : 0; });

    /* lightbox: steps through every photo, starting from the one that was clicked */
    var index = 0, opener = null;
    function show(i) {
      index = (i + photos.length) % photos.length;
      var p = photos[index];
      var lang = root.getAttribute('data-lang') === 'ja' ? 'ja' : 'en';
      img.src = p.src;
      img.alt = p.en || '';
      cap.textContent = p[lang] || '';
    }
    function open(item) {
      var src = item.getAttribute('data-full');
      var start = 0;
      photos.forEach(function (p, k) { if (p.src === src) start = k; });
      opener = item;
      show(start);
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.lightbox__close', box).focus();
    }
    function close() {
      box.hidden = true;
      document.body.style.overflow = '';
      if (opener) opener.focus();
    }
    allItems.forEach(function (it) { it.addEventListener('click', function () { open(it); }); });
    box.addEventListener('click', function (e) {
      var action = e.target.getAttribute && e.target.getAttribute('data-lb');
      if (action === 'prev') show(index - 1);
      else if (action === 'next') show(index + 1);
      else if (action === 'close' || e.target === box) close();
    });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    /* tiles: one tile at a time wipes to its next photo; pauses while the mouse is over
       the photos, off-screen, in a background tab and while the lightbox is open */
    if (reduceMotion || !tiles.length) return;
    var grid = tiles[0].parentNode;
    var at = sets.map(function () { return 0; });
    var order = [0, 2, 1];
    var busy = sets.map(function () { return false; }); // a tile never starts a change while one is loading or playing
    var turn = 0, hovering = false, inView = !('IntersectionObserver' in window);

    function swap(tile, p, done) {
      var old = $$('img', tile);
      var next = document.createElement('img');
      next.className = 'gitem__img--in';
      next.alt = p.en || '';
      if (p.pos) next.style.objectPosition = p.pos;
      next.src = p.src;
      var edge = document.createElement('i');
      edge.className = 'gitem__edge';
      old.forEach(function (o) { o.classList.add('is-leaving'); });
      tile.appendChild(next);
      tile.appendChild(edge);
      tile.setAttribute('data-full', p.src);
      tile.setAttribute('data-cap-en', p.en || '');
      tile.setAttribute('data-cap-ja', p.ja || '');
      tile.classList.remove('is-swapping');
      void tile.offsetWidth; // restart the caption animation
      tile.classList.add('is-swapping');
      setTimeout(function () {
        old.forEach(function (o) { if (o.parentNode) o.parentNode.removeChild(o); });
        if (edge.parentNode) edge.parentNode.removeChild(edge);
        done();
      }, 1350);
    }
    function step() {
      if (document.hidden || hovering || !inView || !box.hidden) return;
      var t = order[turn % order.length];
      turn++;
      var set = sets[t];
      if (!set || set.length < 2 || busy[t]) return;
      var nextAt = (at[t] + 1) % set.length;
      var p = set[nextAt];
      var pre = new Image();
      busy[t] = true;
      pre.onload = function () {
        at[t] = nextAt;
        swap(tiles[t], p, function () { busy[t] = false; });
      };
      pre.onerror = function () { busy[t] = false; };
      pre.src = p.src;
    }

    grid.addEventListener('mouseenter', function () { hovering = true; });
    grid.addEventListener('mouseleave', function () { hovering = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { inView = e[0].isIntersecting; }, { threshold: 0.25 }).observe(grid);
    }
    setInterval(step, 2600);
  })();

  /* ---------- Gallery: "Explore More" shows the extra photos ---------- */
  var gmore = $('#gmore');
  var gmoreBtn = $('#gmoreBtn');
  if (gmore && gmoreBtn) {
    gmoreBtn.addEventListener('click', function () {
      var open = gmore.hidden;
      gmore.hidden = !open;
      gmoreBtn.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- Footer year ---------- */
  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
