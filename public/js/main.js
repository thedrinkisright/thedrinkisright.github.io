// ==========================================================
//  THE DRINK IS RIGHT — main.js
// ==========================================================

// ---- Smooth scroll utility ----
var isScrollingTo = false;

function smoothScrollTo(targetY, onDone) {
  var startY = window.scrollY || window.pageYOffset;
  var distance = targetY - startY;
  var duration = Math.min(700, Math.max(300, Math.abs(distance) * 0.45));
  var startTime = null;
  isScrollingTo = true;
  function ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }
  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    window.scrollTo(0, startY + distance * ease(progress));
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      isScrollingTo = false;
      if (onDone) onDone();
    }
  }
  requestAnimationFrame(step);
}

// ---- Homepage mini form: carry values to /book via URL params ----
var ctaBtn = document.getElementById('cta-book-btn');
if (ctaBtn) {
  ctaBtn.addEventListener('click', function(e) {
    e.preventDefault();
    var name       = document.getElementById('mini-name')  ? document.getElementById('mini-name').value  : '';
    var email      = document.getElementById('mini-email') ? document.getElementById('mini-email').value : '';
    var date       = document.getElementById('mini-date')  ? document.getElementById('mini-date').value  : '';
    var eventType  = document.getElementById('mini-event') ? document.getElementById('mini-event').value : '';
    var params = new URLSearchParams();
    if (name)      params.set('name', name);
    if (email)     params.set('email', email);
    if (date)      params.set('date', date);
    if (eventType) params.set('event_type', eventType);
    var query = params.toString();
    window.location.href = '/book' + (query ? '?' + query : '');
  });
}

// ---- /book page: phone number validation ----
if (document.querySelector('.book-form')) {
  var bookForm = document.querySelector('.book-form');
  var phoneInput = document.querySelector('input[name="phone"]');
  var phoneError = document.createElement('p');
  phoneError.style.cssText = 'color:#E24B4A;font-size:0.78rem;margin-top:0.35rem;display:none;';
  phoneError.textContent = 'Please enter a valid US phone number (e.g. (929) 235-8606)';
  if (phoneInput) {
    phoneInput.parentNode.appendChild(phoneError);

    // Format as user types: (XXX) XXX-XXXX
    phoneInput.addEventListener('input', function() {
      var digits = this.value.replace(/\D/g, '').slice(0, 10);
      var formatted = '';
      if (digits.length > 0) formatted = '(' + digits.slice(0, 3);
      if (digits.length >= 4) formatted += ') ' + digits.slice(3, 6);
      if (digits.length >= 7) formatted += '-' + digits.slice(6, 10);
      this.value = formatted;
      phoneError.style.display = 'none';
      this.style.borderColor = '';
    });

    // Validate on blur
    phoneInput.addEventListener('blur', function() {
      var digits = this.value.replace(/\D/g, '');
      if (this.value.length > 0 && digits.length !== 10) {
        phoneError.style.display = 'block';
        this.style.borderColor = '#E24B4A';
      } else {
        phoneError.style.display = 'none';
        this.style.borderColor = '';
      }
    });

    // Block submit if invalid
    bookForm.addEventListener('submit', function(e) {
      var digits = phoneInput.value.replace(/\D/g, '');
      if (digits.length !== 10) {
        e.preventDefault();
        phoneError.style.display = 'block';
        phoneInput.style.borderColor = '#E24B4A';
        phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneInput.focus();
      }
    });
  }
}


if (document.querySelector('.book-form')) {
  var params = new URLSearchParams(window.location.search);
  var fieldMap = {
    'name':       'name',
    'email':      'email',
    'date':       'event_date',
    'event_type': 'event_type'
  };
  Object.keys(fieldMap).forEach(function(param) {
    var val = params.get(param);
    if (!val) return;
    var el = document.querySelector('[name="' + fieldMap[param] + '"]');
    if (el) el.value = val;
  });
}

// ---- Prevent ALL caching — works on refresh, back button, and bfcache ----
// 1. Unload listener disables bfcache in Chrome/Firefox/Safari
window.addEventListener('unload', function() {});

// 2. pageshow handles bfcache fallback
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    window.scrollTo(0, 0);
    window.location.reload(true);
  }
});

// 3. performance.navigation detects page reload and forces fresh load
// Handles Ctrl+R / Cmd+R refresh from cache
if (window.performance) {
  var navType = performance.getEntriesByType
    ? (performance.getEntriesByType('navigation')[0] || {}).type
    : (performance.navigation || {}).type;
  if (navType === 'back_forward') {
    window.location.reload(true);
  }
}

// ---- Nav theme: switches dark/light based on current section ----
const header = document.getElementById('site-header');

function setNavTheme(theme) {
  if (theme === 'light') {
    header.classList.add('scrolled');
    header.classList.remove('nav-dark');
  } else {
    header.classList.remove('scrolled');
    header.classList.add('nav-dark');
  }
}

// Start with correct theme immediately
if (document.querySelector('.careers-body')) {
  header.classList.add('scrolled');
} else {
  header.classList.add('nav-dark');
}

// Use scroll position to find which section the nav is currently over
const themeSections = Array.from(document.querySelectorAll('[data-nav-theme]'));

function updateNavTheme() {
  if (isScrollingTo) return; // don't override during smooth scroll
  const navBottom = header.offsetHeight;
  let currentTheme = 'dark';
  for (let i = themeSections.length - 1; i >= 0; i--) {
    const rect = themeSections[i].getBoundingClientRect();
    if (rect.top <= navBottom) {
      currentTheme = themeSections[i].dataset.navTheme;
      break;
    }
  }
  setNavTheme(currentTheme);
}

window.addEventListener('scroll', updateNavTheme, { passive: true });
updateNavTheme(); // run once on load

// ---- Scroll-away nav (careers and book pages) ----
if (document.querySelector('.careers-body') || document.querySelector('.book-form') || document.querySelector('.about-body')) {
  // Auto-hide nav and position form on /book page
  if (document.querySelector('.book-form')) {
    setTimeout(function() {
      var bookInner = document.querySelector('.book-inner');
      if (bookInner) {
        var rect = bookInner.getBoundingClientRect();
        var targetY = rect.top + window.scrollY - 20;
        window.scrollTo(0, Math.max(1, targetY));
      } else {
        window.scrollTo(0, 1);
      }
    }, 50);
  }

  window.addEventListener('scroll', function () {
    if (window.scrollY <= 0) {
      header.classList.remove('nav-hidden');
    } else {
      header.classList.add('nav-hidden');
    }
  }, { passive: true });

  // About page: show nav when CTA section comes into view
  if (document.querySelector('.about-body')) {
    var aboutCta = document.querySelector('.about-body ~ .cta-section');
    if (aboutCta) {
      new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            header.classList.remove('nav-hidden');
          } else if (window.scrollY > 0) {
            header.classList.add('nav-hidden');
          }
        });
      }, { threshold: 0.05 }).observe(aboutCta);
    }
  }
}


const hamburger   = document.querySelector('.hamburger');
const mobileNav   = document.getElementById('mobile-nav');

hamburger?.addEventListener('click', () => {
  const open = mobileNav.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', open);
  mobileNav.setAttribute('aria-hidden', !open);
});

// Close on link click
mobileNav?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    hamburger.setAttribute('aria-expanded', false);
    mobileNav.setAttribute('aria-hidden', true);
  });
});

// ---- Scroll reveal ----
const revealEls = document.querySelectorAll(
  '.occ-card, .svc-card, .why-card, .testi-card, .value-item, .occ-detail, .stat-block, .drink-img'
);

revealEls.forEach(el => el.classList.add('reveal'));

const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger siblings
      const siblings = [...entry.target.parentElement.querySelectorAll('.reveal')];
      const idx = siblings.indexOf(entry.target);
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, idx * 80);
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

revealEls.forEach(el => revealObs.observe(el));

// ---- Smooth scroll for hash links ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const id = anchor.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      // Immediately switch nav theme to match destination section
      if (target.dataset.navTheme) {
        setNavTheme(target.dataset.navTheme);
      }
      const navHeight = header ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 32;
      smoothScrollTo(Math.max(0, top));
    }
  });
});
