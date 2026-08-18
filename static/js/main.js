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

// ---- /book page: two-step flow (choose package -> event details) ----
if (document.getElementById('book-step-1')) {
  // Reset here (before any deep-link tier gets applied below) so the later
  // "always reset on load" block doesn't wipe out a deep-linked selection.
  var bookFormEarly = document.querySelector('.book-form');
  if (bookFormEarly) bookFormEarly.reset();

  var step1 = document.getElementById('book-step-1');
  var step2 = document.getElementById('book-step-2');
  var progressSteps = document.querySelectorAll('.book-progress-step');
  var tierCards = document.querySelectorAll('.tier-select-card');
  var skipBtn = document.getElementById('tier-skip-btn');
  var changeBtn = document.getElementById('change-package-btn');
  var tierInput = document.getElementById('service_tier');
  var chip = document.getElementById('selected-package-chip');
  var chipName = document.getElementById('selected-package-name');
  var chipPrice = document.getElementById('selected-package-price');

  function scrollToBookTop() {
    var bookInner = document.querySelector('.book-inner');
    if (!bookInner) return;
    var rect = bookInner.getBoundingClientRect();
    var targetY = rect.top + window.scrollY - 20;
    smoothScrollTo(Math.max(0, targetY));
  }

  function setActiveProgress(n) {
    progressSteps.forEach(function(el) {
      el.classList.toggle('is-active', parseInt(el.dataset.step, 10) <= n);
    });
  }

  function goToStep2(tierName, tierPrice) {
    if (tierName) {
      tierInput.value = tierName;
      chipName.textContent = tierName === 'Not Sure Yet' ? "We'll help you choose" : tierName;
      chipPrice.textContent = tierPrice ? '— ' + tierPrice : '';
      chip.hidden = false;
    } else {
      tierInput.value = '';
      chip.hidden = true;
    }
    step1.hidden = true;
    step2.hidden = false;
    setActiveProgress(2);
    scrollToBookTop();
  }

  function goToStep1() {
    step2.hidden = true;
    step1.hidden = false;
    setActiveProgress(1);
    scrollToBookTop();
  }

  tierCards.forEach(function(card) {
    card.addEventListener('click', function() {
      goToStep2(card.dataset.tier, card.dataset.price);
    });
  });

  if (skipBtn) {
    skipBtn.addEventListener('click', function() { goToStep2('Not Sure Yet', null); });
  }

  if (changeBtn) {
    changeBtn.addEventListener('click', goToStep1);
  }

  var step1Progress = document.querySelector('.book-progress-step[data-step="1"]');
  if (step1Progress) {
    step1Progress.style.cursor = 'pointer';
    step1Progress.addEventListener('click', function() {
      if (step2 && !step2.hidden) goToStep1();
    });
  }

  // Deep link support: /book?tier=Full%20Bar jumps straight to step 2
  var tierParam = new URLSearchParams(window.location.search).get('tier');
  if (tierParam) {
    var matchCard = null;
    tierCards.forEach(function(card) {
      if (card.dataset.tier.toLowerCase() === tierParam.toLowerCase()) matchCard = card;
    });
    if (matchCard) {
      goToStep2(matchCard.dataset.tier, matchCard.dataset.price);
    }
  }
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
  }

  var dateInput = document.getElementById('date');
  var hoursInput = document.getElementById('event_hours');

  function todayISO() {
    var d = new Date();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
  }

  function attachFieldError(input, message) {
    var err = document.createElement('p');
    err.className = 'form-error';
    err.style.cssText = 'color:#E24B4A;font-size:0.78rem;margin-top:0.35rem;display:none;';
    err.textContent = message;
    if (input && input.parentNode) {
      var wrap = input.closest('.form-group') || input.parentNode;
      wrap.appendChild(err);
    }
    return err;
  }

  function showFieldError(input, errEl, show) {
    if (errEl) errEl.style.display = show ? 'block' : 'none';
    if (input) input.style.borderColor = show ? '#E24B4A' : '';
  }

  var dateError = attachFieldError(dateInput, 'Please choose today or a future date.');
  var hoursError = attachFieldError(hoursInput, 'Enter a whole number of hours greater than 0.');

  if (dateInput) {
    dateInput.min = todayISO();
    dateInput.addEventListener('change', function() {
      var today = todayISO();
      var past = this.value && this.value < today;
      showFieldError(this, dateError, past);
    });
  }

  function hoursInvalid(requireValue) {
    if (!hoursInput) return false;
    if (!hoursInput.value) return !!requireValue;
    if (!/^[1-9]\d*$/.test(hoursInput.value.trim())) return true;
    return parseInt(hoursInput.value, 10) < 1;
  }

  if (hoursInput) {
    hoursInput.addEventListener('input', function() {
      this.value = this.value.replace(/[^\d]/g, '');
      if (this.value === '0') this.value = '';
      showFieldError(this, hoursError, hoursInvalid(false));
    });
    hoursInput.addEventListener('blur', function() {
      showFieldError(this, hoursError, hoursInvalid(false));
    });
  }

  bookForm.addEventListener('submit', function(e) {
    e.preventDefault();

    if (phoneInput) {
      var digits = phoneInput.value.replace(/\D/g, '');
      if (digits.length !== 10) {
        phoneError.style.display = 'block';
        phoneInput.style.borderColor = '#E24B4A';
        phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneInput.focus();
        return;
      }
    }

    if (dateInput && dateInput.value && dateInput.value < todayISO()) {
      showFieldError(dateInput, dateError, true);
      dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      dateInput.focus();
      return;
    }

    if (hoursInvalid(true)) {
      showFieldError(hoursInput, hoursError, true);
      hoursInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hoursInput.focus();
      return;
    }

    var submitBtn = bookForm.querySelector('[type="submit"]');
    var statusEl = document.getElementById('book-form-status');
    var originalLabel = submitBtn ? submitBtn.textContent : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = '';
    }

    fetch(bookForm.action, {
      method: 'POST',
      body: new FormData(bookForm),
      headers: { 'Accept': 'application/json' }
    }).then(function(res) {
      if (res.ok) {
        try { sessionStorage.setItem('tdrBookingComplete', '1'); } catch (err) {}
        window.location.href = '/thank-you/';
        return;
      }
      return res.json().then(function(data) {
        var msg = 'Something went wrong. Please try again or call us.';
        if (data && data.errors && data.errors[0] && data.errors[0].message) {
          msg = data.errors[0].message;
        }
        throw new Error(msg);
      }, function() {
        throw new Error('Something went wrong. Please try again or call us.');
      });
    }).catch(function(err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = err.message || 'Something went wrong. Please try again or call us.';
      }
    });
  });
}


if (document.querySelector('.book-form')) {
  var bookFormEl = document.querySelector('.book-form');

  // (Form is already reset above, before tier deep-linking runs, so cached
  // values from the browser back button are cleared without wiping the tier.)

  // Pre-fill from URL params if coming from homepage mini form
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

// ---- Scroll-away nav (careers, book, about, packages) ----
if (document.querySelector('.careers-body') || document.querySelector('.book-form') || document.querySelector('.about-body') || document.querySelector('.pkg-page') || document.querySelector('.menu-body')) {
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
