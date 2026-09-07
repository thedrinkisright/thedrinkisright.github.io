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

var MIN_BOOKING_HOURS = 3;
var MAX_BOOKING_HOURS = 6;
var STARTING_FROM_HOURS = 3;
var DEFAULT_BOOKING_HOURS = 3;

function billableHours(hours) {
  return hours;
}

function parseGuestCountValue(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  var value = String(raw).trim();
  if (!/^[1-9]\d*$/.test(value)) return null;
  return parseInt(value, 10);
}

function guestPricingFromCount(count) {
  var pricing = {
    guestBand: 'Up to 25',
    guestHourly: 0,
    bartenders: 1,
    isCustomQuote: false,
    guestCount: count
  };

  if (count == null || count < 1) {
    pricing.guestCount = null;
    return pricing;
  }

  if (count > 100) {
    pricing.guestBand = '100+';
    pricing.bartenders = 0;
    pricing.isCustomQuote = true;
    return pricing;
  }

  if (count > 80) {
    pricing.guestBand = '80–100';
    pricing.bartenders = 2;
    return pricing;
  }

  if (count > 50) {
    pricing.guestBand = '50–80';
    pricing.bartenders = 2;
    return pricing;
  }

  if (count > 25) {
    pricing.guestBand = '25–50';
    pricing.guestHourly = 30;
    pricing.bartenders = 1;
    return pricing;
  }

  return pricing;
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
if (document.getElementById('book-wizard-step-1')) {
  var bookFormEarly = document.querySelector('.book-form');
  if (bookFormEarly) bookFormEarly.reset();

  var BOOK_WIZARD_TOTAL = 6;
  var currentWizardStep = 1;
  var wizardPanels = document.querySelectorAll('.book-wizard-step');
  var progressSteps = document.querySelectorAll('.book-progress-step');
  var changeBtn = document.getElementById('change-package-btn');
  var tierInput = document.getElementById('service_tier');
  var packagePathInput = document.getElementById('package_path');
  var selectedAddonsInput = document.getElementById('selected_addons');
  var addonsTotalInput = document.getElementById('addons_total');
  var addonsPanel = document.getElementById('addons-panel');
  var addonsStickyTotal = document.getElementById('addons-sticky-total');
  var pathAddonsBtn = document.getElementById('path-addons-btn');
  var pathBartenderBtn = document.getElementById('path-bartender-btn');
  var addonsContinueBtn = document.getElementById('addons-continue-btn');
  var chip = document.getElementById('selected-package-chip');
  var chipName = document.getElementById('selected-package-name');
  var estimateReviewEl = document.getElementById('selected-package-estimate-review');
  var estimateAmount = document.getElementById('selected-package-estimate-amount');
  var estimateBreakdown = document.getElementById('selected-package-estimate-breakdown');
  var reviewSummaryEl = document.getElementById('book-review-summary');
  var estimatedTotalInput = document.getElementById('estimated_total');
  var estimateBreakdownInput = document.getElementById('estimate_breakdown');
  var bartenderCountGroup = document.getElementById('bartender-count-group');
  var bartenderCountRadios = document.querySelectorAll('input[name="bartender_count"]');
  var holidayUpchargeInput = document.getElementById('holiday_upcharge');
  var hoursInputLive = document.getElementById('event_hours');
  var drinkingGuestsLive = document.getElementById('guests_drinking_21_plus');
  var bartenderRecommendHint = document.getElementById('bartender-recommend-hint');
  var dateInputLive = document.getElementById('date');
  var dateHolidayHint = document.getElementById('date-holiday-hint');
  var eventTypeInput = document.getElementById('event_type');
  var selectedHourly = 0;
  var selectedTier = '';
  var selectedPackagePath = '';
  var selectedAddons = {};
  var BARTENDER_HOURLY = 120;

  // 50+ — blended team rate (2 bartenders included); 100+ is custom quote
  var BLENDED_TEAM_HOURLY = {
    '50–80': {
      'Bartender': 185,
      'Basic Bar': 225,
      'Full Bar': 280
    },
    '80–100': {
      'Bartender': 200,
      'Basic Bar': 240,
      'Full Bar': 310
    }
  };

  var HOLIDAY_PEAK_PERCENT = 20;
  var HOLIDAY_HIGH_PERCENT = 15;

  function parseISODateLocal(iso) {
    if (!iso) return null;
    var parts = iso.split('-');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function isSameCalendarDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function addCalendarDays(date, days) {
    var next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function nthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
    var cursor = new Date(year, monthIndex, 1);
    var count = 0;
    while (cursor.getMonth() === monthIndex) {
      if (cursor.getDay() === weekday) {
        count++;
        if (count === occurrence) return new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return null;
  }

  function lastWeekdayOfMonth(year, monthIndex, weekday) {
    var cursor = new Date(year, monthIndex + 1, 0);
    while (cursor.getDay() !== weekday) {
      cursor.setDate(cursor.getDate() - 1);
    }
    return cursor;
  }

  function memorialDay(year) {
    return lastWeekdayOfMonth(year, 4, 1);
  }

  function laborDay(year) {
    return nthWeekdayOfMonth(year, 8, 1, 1);
  }

  function thanksgivingDay(year) {
    return nthWeekdayOfMonth(year, 10, 4, 4);
  }

  function easterSunday(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function mlkDay(year) {
    return nthWeekdayOfMonth(year, 0, 1, 3);
  }

  function presidentsDay(year) {
    return nthWeekdayOfMonth(year, 1, 1, 3);
  }

  function mothersDay(year) {
    return nthWeekdayOfMonth(year, 4, 0, 2);
  }

  function fathersDay(year) {
    return nthWeekdayOfMonth(year, 5, 0, 3);
  }

  function columbusDay(year) {
    return nthWeekdayOfMonth(year, 9, 1, 2);
  }

  function isMemorialDayWeekend(date) {
    var monday = memorialDay(date.getFullYear());
    return isSameCalendarDay(date, addCalendarDays(monday, -2))
      || isSameCalendarDay(date, addCalendarDays(monday, -1))
      || isSameCalendarDay(date, monday);
  }

  function isLaborDayWeekend(date) {
    var monday = laborDay(date.getFullYear());
    return isSameCalendarDay(date, addCalendarDays(monday, -2))
      || isSameCalendarDay(date, addCalendarDays(monday, -1))
      || isSameCalendarDay(date, monday);
  }

  function getHolidayUpcharge(isoDate) {
    var date = parseISODateLocal(isoDate);
    if (!date) return null;

    var month = date.getMonth() + 1;
    var day = date.getDate();
    var year = date.getFullYear();
    var thanksgiving = thanksgivingDay(year);
    var easter = easterSunday(year);

    // Peak (+20%) — highest-demand event dates
    if (month === 12 && day === 31) {
      return { label: "New Year's Eve", percent: HOLIDAY_PEAK_PERCENT };
    }
    if (month === 7 && day === 4) {
      return { label: 'Independence Day', percent: HOLIDAY_PEAK_PERCENT };
    }
    if (isSameCalendarDay(date, addCalendarDays(thanksgiving, -1))) {
      return { label: 'Thanksgiving Eve', percent: HOLIDAY_PEAK_PERCENT };
    }
    if (month === 2 && day === 14) {
      return { label: "Valentine's Day", percent: HOLIDAY_PEAK_PERCENT };
    }
    if (month === 3 && day === 17) {
      return { label: "St. Patrick's Day", percent: HOLIDAY_PEAK_PERCENT };
    }
    if (month === 10 && day === 31) {
      return { label: 'Halloween', percent: HOLIDAY_PEAK_PERCENT };
    }
    if (isSameCalendarDay(date, easter)) {
      return { label: 'Easter Sunday', percent: HOLIDAY_PEAK_PERCENT };
    }

    // High (+15%) — federal holidays and major event dates
    if (month === 1 && day === 1) {
      return { label: "New Year's Day", percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, mlkDay(year))) {
      return { label: 'Martin Luther King Jr. Day', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, presidentsDay(year))) {
      return { label: "Presidents' Day", percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, addCalendarDays(easter, -2))) {
      return { label: 'Good Friday', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, mothersDay(year))) {
      return { label: "Mother's Day", percent: HOLIDAY_HIGH_PERCENT };
    }
    if (month === 6 && day === 19) {
      return { label: 'Juneteenth', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, fathersDay(year))) {
      return { label: "Father's Day", percent: HOLIDAY_HIGH_PERCENT };
    }
    if (month === 7 && day === 3) {
      return { label: 'Independence Day Eve', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isMemorialDayWeekend(date)) {
      return { label: 'Memorial Day weekend', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isLaborDayWeekend(date)) {
      return { label: 'Labor Day weekend', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, columbusDay(year))) {
      return { label: 'Columbus Day', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (month === 11 && day === 11) {
      return { label: 'Veterans Day', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, thanksgiving)) {
      return { label: 'Thanksgiving', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (isSameCalendarDay(date, addCalendarDays(thanksgiving, 1))) {
      return { label: 'Black Friday', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (month === 12 && day === 24) {
      return { label: 'Christmas Eve', percent: HOLIDAY_HIGH_PERCENT };
    }
    if (month === 12 && day === 25) {
      return { label: 'Christmas Day', percent: HOLIDAY_HIGH_PERCENT };
    }

    return null;
  }

  function formatHolidayUpchargeField(holiday, fee) {
    if (!holiday) return '';
    if (fee == null) return holiday.label + ' (+' + holiday.percent + '%)';
    return holiday.label + ' (+' + holiday.percent + '%, ' + formatMoney(fee) + ')';
  }

  function updateHolidayDateHint() {
    if (!dateHolidayHint) return;
    var holiday = dateInputLive && dateInputLive.value
      ? getHolidayUpcharge(dateInputLive.value)
      : null;
    if (!holiday) {
      dateHolidayHint.hidden = true;
      dateHolidayHint.textContent = '';
      return;
    }
    dateHolidayHint.textContent = holiday.label + ' — a +' + holiday.percent + '% upcharge applies to your estimate.';
    dateHolidayHint.hidden = false;
  }

  function formatMoney(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function guestPricingFromInput(input) {
    return guestPricingFromCount(parseGuestCountValue(input && input.value));
  }

  function recommendedBartenders(count) {
    if (count == null || count < 1) return 1;
    if (count > 100) return 3;
    if (count > 50) return 2;
    return 1;
  }

  function getBartenderCountRadio() {
    return document.querySelector('input[name="bartender_count"]:checked');
  }

  function setBartenderCountValue(value) {
    var radio = document.querySelector('input[name="bartender_count"][value="' + value + '"]');
    if (radio) radio.checked = true;
  }

  function selectedBartenderCount() {
    var checked = getBartenderCountRadio();
    if (!checked || !checked.value) return null;
    var n = parseInt(checked.value, 10);
    return isNaN(n) ? null : n;
  }

  function updateBartenderRecommendation() {
    var count = parseGuestCountValue(drinkingGuestsLive && drinkingGuestsLive.value);
    var recommended = recommendedBartenders(count);
    if (bartenderRecommendHint) {
      if (count == null || count < 1) {
        bartenderRecommendHint.textContent = 'Move the guest slider for a staffing recommendation';
      } else if (count > 100) {
        bartenderRecommendHint.textContent = 'Recommendation: 3 bartenders (custom quote for 100+)';
      } else {
        bartenderRecommendHint.textContent = 'Recommendation: ' + recommended + ' bartender' + (recommended === 1 ? '' : 's');
      }
    }
    if (bartenderCountRadios.length && count != null && count >= 1) {
      setBartenderCountValue(String(recommended));
      if (bartenderCountGroup) bartenderCountGroup.classList.remove('is-invalid');
    }
  }

  function requiredBartenders(guestPricing) {
    if (guestPricing.isCustomQuote) return 0;
    var selected = selectedBartenderCount();
    if (selected != null) return selected;
    return guestPricing.bartenders;
  }

  function calcEstimate(hourly, hours, guestPricing, tierName) {
    if (guestPricing.isCustomQuote) {
      return {
        isCustomQuote: true,
        total: null,
        hourly: 0,
        guestHourly: 0,
        supplyHourly: 0,
        extraBartenders: 0,
        extraBartenderHourly: 0,
        isTeamRate: false,
        effectiveHourly: 0,
        hours: hours,
        guestBand: guestPricing.guestBand,
        guestCount: guestPricing.guestCount,
        bartenders: selectedBartenderCount() || 0
      };
    }

    var bartenders = requiredBartenders(guestPricing);
    var bandRates = BLENDED_TEAM_HOURLY[guestPricing.guestBand];
    var blended = bandRates && bandRates[tierName];
    var billed = billableHours(hours);
    if (blended) {
      return {
        isCustomQuote: false,
        total: blended * billed,
        hourly: blended,
        guestHourly: 0,
        supplyHourly: 0,
        extraBartenders: Math.max(0, bartenders - 1),
        extraBartenderHourly: 0,
        isTeamRate: true,
        effectiveHourly: blended,
        hours: hours,
        billableHours: billed,
        guestBand: guestPricing.guestBand,
        guestCount: guestPricing.guestCount,
        bartenders: bartenders
      };
    }

    // ≤50 — tier hourly + guest add
    var effectiveHourly = hourly + guestPricing.guestHourly;
    return {
      isCustomQuote: false,
      total: effectiveHourly * billed,
      hourly: hourly,
      guestHourly: guestPricing.guestHourly,
      supplyHourly: 0,
      extraBartenders: Math.max(0, bartenders - 1),
      extraBartenderHourly: 0,
      isTeamRate: false,
      effectiveHourly: effectiveHourly,
      hours: hours,
      billableHours: billed,
      guestBand: guestPricing.guestBand,
      guestCount: guestPricing.guestCount,
      bartenders: bartenders
    };
  }

  function formatGuestBand(guestBand, guestCount) {
    if (guestCount != null && guestCount > 0) {
      return guestCount + ' guest' + (guestCount === 1 ? '' : 's');
    }
    if (guestBand === 'Up to 25') return 'up to 25 guests';
    return guestBand + ' guests';
  }

  function formatHoursLabel(hours) {
    return hours + (hours === 1 ? ' hour' : ' hours');
  }

  function holidayBreakdownLine(holiday, holidayFee) {
    var label = 'Holiday Upcharge: ' + holiday.label;
    if (holidayFee != null) {
      return label + ' · +' + holiday.percent + '% (' + formatMoney(holidayFee) + ')';
    }
    return label + ' · holiday fee applies';
  }

  function buildEstimateBreakdown(result, holiday, holidayFee) {
    if (result.isCustomQuote) {
      var guestLabel = result.guestCount != null ? result.guestCount + ' guests' : '100+ guests';
      var customText = guestLabel + '\nWe will contact you with further information.';
      if (holiday) {
        customText += '\n' + holidayBreakdownLine(holiday, null);
      }
      return customText;
    }

    var line1 = formatHoursLabel(result.hours) + ' for ' + formatGuestBand(result.guestBand, result.guestCount);

    var hourlyRate = result.isTeamRate ? result.hourly : result.effectiveHourly;
    var bartenderLabel = result.bartenders === 1 ? '1 bartender' : result.bartenders + ' bartenders';
    var line2 = bartenderLabel + ' for ' + formatMoney(hourlyRate) + '/hr';

    var text = line1 + '\n' + line2;
    if (holiday) {
      text += '\n' + holidayBreakdownLine(holiday, holidayFee);
    }
    var addons = getSelectedAddonsSummary();
    if (addons.total > 0) {
      text += '\nAdd-ons: ' + formatMoney(addons.total);
      if (addons.labels.length) {
        text += ' (' + addons.labels.join(', ') + ')';
      }
    }
    return text;
  }

  function drinkingGuestCountForAddons() {
    return parseGuestCountValue(drinkingGuestsLive && drinkingGuestsLive.value) || 0;
  }

  var ALL_INCLUSIVE_INCLUDED = [
    'juices_limes',
    'premium_mixers',
    'soft_drinks',
    'bottled_waters',
    'cooler',
    'bagged_ice',
    'cups_straws'
  ];

  function getSelectedAddonsSummary() {
    var guests = drinkingGuestCountForAddons();
    var total = 0;
    var labels = [];
    Object.keys(selectedAddons).forEach(function(id) {
      var card = document.querySelector('.addon-card[data-addon-id="' + id + '"]');
      if (!card) return;
      var price = parseFloat(card.dataset.price || '0');
      var unit = card.dataset.unit || 'guest';
      var qty = selectedAddons[id] || 1;
      var line = unit === 'each' ? price * qty : price * guests;
      total += line;
      var name = card.querySelector('.addon-card-name');
      var label = name ? name.textContent : id;
      if (unit === 'each' && qty > 1) label += ' ×' + qty;
      labels.push(label);
    });
    return { total: total, labels: labels };
  }

  function syncAddonGuestLineTotals() {
    var guests = drinkingGuestCountForAddons();
    document.querySelectorAll('.addon-card[data-unit="guest"]').forEach(function(card) {
      var lineEl = card.querySelector('.addon-card-line-total');
      var basisEl = card.querySelector('.addon-card-guest-basis');
      var countEl = card.querySelector('.addon-card-guest-count');
      var id = card.dataset.addonId;
      var show = !!selectedAddons[id] && !card.classList.contains('is-bundled');
      if (lineEl) {
        if (!show) {
          lineEl.hidden = true;
          lineEl.textContent = '';
        } else {
          var price = parseFloat(card.dataset.price || '0');
          lineEl.textContent = '+' + formatMoney(price * guests);
          lineEl.hidden = false;
        }
      }
      if (basisEl) {
        if (countEl) countEl.textContent = String(guests || 0);
        basisEl.hidden = !show;
      }
    });
    syncAddonsStickyTotal();
  }

  function syncAddonsStickyTotal() {
    if (!addonsStickyTotal) return;
    var total = getSelectedAddonsSummary().total;
    addonsStickyTotal.textContent = formatMoney(total);
  }

  function setAddonsCategory(category) {
    var next = category || 'mixers';
    document.querySelectorAll('.addons-category-chip').forEach(function(chip) {
      var active = chip.getAttribute('data-addons-category') === next;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.addons-section[data-addons-category]').forEach(function(section) {
      section.hidden = section.getAttribute('data-addons-category') !== next;
    });
  }

  function syncAddonHiddenFields() {
    var summary = getSelectedAddonsSummary();
    if (selectedAddonsInput) {
      selectedAddonsInput.value = summary.labels.join('; ');
    }
    if (addonsTotalInput) {
      addonsTotalInput.value = summary.total ? formatMoney(summary.total) : '';
    }
    syncAddonGuestLineTotals();
  }

  function syncAllInclusiveBundle(selected) {
    ALL_INCLUSIVE_INCLUDED.forEach(function(id) {
      var card = document.querySelector('.addon-card[data-addon-id="' + id + '"]');
      if (!card) return;
      var toggle = card.querySelector('.addon-toggle');
      var priceEl = card.querySelector('.addon-card-price');
      if (priceEl && !priceEl.dataset.originalHtml) {
        priceEl.dataset.originalHtml = priceEl.innerHTML;
      }
      if (selected) {
        card.classList.add('is-selected', 'is-bundled');
        if (toggle) {
          toggle.textContent = '✓';
          toggle.setAttribute('aria-pressed', 'true');
          toggle.setAttribute('aria-label', 'Included in All-Inclusive Package');
        }
        if (priceEl) {
          priceEl.classList.add('addon-card-price--covered');
          priceEl.innerHTML =
            '<span class="addon-covered-check" aria-hidden="true">✓</span>' +
            '<span class="addon-covered-label">Covered by All-Inclusive</span>';
        }
      } else {
        card.classList.remove('is-bundled');
        if (priceEl && priceEl.dataset.originalHtml) {
          priceEl.classList.remove('addon-card-price--covered');
          priceEl.innerHTML = priceEl.dataset.originalHtml;
        }
        if (!selectedAddons[id]) {
          card.classList.remove('is-selected');
          if (toggle) {
            toggle.textContent = '+';
            toggle.setAttribute('aria-pressed', 'false');
            var name = card.querySelector('.addon-card-name');
            toggle.setAttribute('aria-label', 'Add ' + (name ? name.textContent : id));
          }
        }
      }
    });
  }

  function setAddonSelected(card, selected, qty) {
    var id = card.dataset.addonId;
    var toggle = card.querySelector('.addon-toggle');
    var qtyWrap = card.querySelector('.addon-qty');
    var qtyValue = card.querySelector('.addon-qty-value');
    if (selected) {
      selectedAddons[id] = qty || selectedAddons[id] || 1;
      card.classList.add('is-selected');
      if (toggle) {
        toggle.textContent = '✓';
        toggle.setAttribute('aria-pressed', 'true');
      }
      if (qtyWrap && card.dataset.unit === 'each') {
        qtyWrap.hidden = false;
        if (qtyValue) qtyValue.textContent = String(selectedAddons[id]);
      }
    } else {
      delete selectedAddons[id];
      card.classList.remove('is-selected');
      if (toggle) {
        toggle.textContent = '+';
        toggle.setAttribute('aria-pressed', 'false');
      }
      if (qtyWrap) qtyWrap.hidden = true;
    }
  }

  function clearCoreMixersExcept(keepId) {
    document.querySelectorAll('.addon-card[data-group="core-mixers"]').forEach(function(card) {
      if (card.dataset.addonId === keepId) return;
      if (ALL_INCLUSIVE_INCLUDED.indexOf(card.dataset.addonId) !== -1) return;
      setAddonSelected(card, false);
    });
  }

  function toggleAddonCard(card) {
    var id = card.dataset.addonId;
    if (selectedAddons.all_inclusive && ALL_INCLUSIVE_INCLUDED.indexOf(id) !== -1) {
      return;
    }
    var isOn = !!selectedAddons[id];
    if (!isOn && card.dataset.group === 'core-mixers') {
      if (id === 'all_inclusive') {
        clearCoreMixersExcept('all_inclusive');
        ALL_INCLUSIVE_INCLUDED.forEach(function(bundledId) {
          var bundledCard = document.querySelector('.addon-card[data-addon-id="' + bundledId + '"]');
          if (bundledCard) setAddonSelected(bundledCard, false);
        });
      } else if (selectedAddons.all_inclusive) {
        setAddonSelected(document.querySelector('.addon-card[data-addon-id="all_inclusive"]'), false);
        syncAllInclusiveBundle(false);
      }
    }
    setAddonSelected(card, !isOn, 1);
    if (id === 'all_inclusive') {
      syncAllInclusiveBundle(!isOn);
    }
    syncAddonHiddenFields();
    updateEstimate();
  }

  function updateAddonQty(card, delta) {
    var id = card.dataset.addonId;
    if (!selectedAddons[id]) return;
    var max = parseInt(card.dataset.maxQty || '4', 10);
    var next = selectedAddons[id] + delta;
    if (next < 1) {
      setAddonSelected(card, false);
    } else {
      setAddonSelected(card, true, Math.min(max, next));
    }
    syncAddonHiddenFields();
    updateEstimate();
  }

  function clearAllAddons() {
    selectedAddons = {};
    document.querySelectorAll('.addon-card').forEach(function(card) {
      setAddonSelected(card, false);
    });
    syncAllInclusiveBundle(false);
    syncAddonHiddenFields();
  }

  function setPathButtonsActive(path) {
    if (pathAddonsBtn) pathAddonsBtn.classList.toggle('is-active', path === 'addons');
    if (pathBartenderBtn) pathBartenderBtn.classList.toggle('is-active', path === 'bartender');
  }

  function showAddonsPanel(show) {
    if (!addonsPanel) return;
    addonsPanel.hidden = !show;
    if (show) {
      setAddonsCategory('mixers');
      syncAddonsStickyTotal();
    }
  }

  function setStep4PathSelected(selected) {
    var flow = document.getElementById('book-step-4-flow');
    var topNav = document.getElementById('book-step-4-nav-top');
    var bottomNav = document.getElementById('book-step-4-nav-bottom');
    if (flow) flow.classList.toggle('is-path-selected', !!selected);
    if (topNav) topNav.hidden = !!selected;
    if (bottomNav) bottomNav.hidden = !selected;
  }

  function updateEstimate() {
    if (!selectedHourly) {
      if (estimateReviewEl) estimateReviewEl.hidden = true;
      if (estimatedTotalInput) estimatedTotalInput.value = '';
      if (estimateBreakdownInput) estimateBreakdownInput.value = '';
      if (holidayUpchargeInput) holidayUpchargeInput.value = '';
      syncAddonHiddenFields();
      updateHolidayDateHint();
      return;
    }

    var hours = hoursInputLive && hoursInputLive.value
      ? parseInt(hoursInputLive.value, 10)
      : DEFAULT_BOOKING_HOURS;
    if (!hours || hours < MIN_BOOKING_HOURS) hours = MIN_BOOKING_HOURS;
    if (hours > MAX_BOOKING_HOURS) hours = MAX_BOOKING_HOURS;

    var guestPricing = guestPricingFromInput(drinkingGuestsLive);
    var result = calcEstimate(selectedHourly, hours, guestPricing, 'Bartender');
    var holiday = dateInputLive && dateInputLive.value
      ? getHolidayUpcharge(dateInputLive.value)
      : null;
    updateHolidayDateHint();

    var addons = getSelectedAddonsSummary();
    var totalText;
    var breakdownText;
    var holidayFee = null;

    if (result.isCustomQuote) {
      totalText = 'Custom Quote';
      breakdownText = buildEstimateBreakdown(result, holiday, null);
    } else {
      holidayFee = holiday ? Math.round(result.total * holiday.percent / 100) : null;
      var grand = result.total + (holidayFee || 0) + addons.total;
      totalText = formatMoney(grand);
      breakdownText = buildEstimateBreakdown(result, holiday, holidayFee);
    }

    syncAddonHiddenFields();

    if (estimateReviewEl) estimateReviewEl.hidden = false;
    if (estimateAmount) {
      estimateAmount.textContent = totalText;
      estimateAmount.classList.remove('is-flash');
      void estimateAmount.offsetWidth;
      estimateAmount.classList.add('is-flash');
    }
    if (estimateBreakdown) estimateBreakdown.textContent = breakdownText;

    if (estimatedTotalInput) estimatedTotalInput.value = totalText;
    if (estimateBreakdownInput) estimateBreakdownInput.value = breakdownText;
    if (holidayUpchargeInput) {
      holidayUpchargeInput.value = formatHolidayUpchargeField(holiday, holidayFee);
    }
  }

  function scrollToBookTop() {
    var bookInner = document.querySelector('.book-inner');
    if (!bookInner) return;
    var rect = bookInner.getBoundingClientRect();
    var targetY = rect.top + window.scrollY - 20;
    smoothScrollTo(Math.max(0, targetY));
  }

  function setActiveProgress(n) {
    progressSteps.forEach(function(el) {
      var stepNum = parseInt(el.dataset.step, 10);
      el.classList.toggle('is-active', stepNum <= n);
      el.classList.toggle('is-complete', stepNum < n);
      el.disabled = stepNum > n;
      if (stepNum === n) {
        el.setAttribute('aria-current', 'step');
      } else {
        el.removeAttribute('aria-current');
      }
    });
  }

  function setPackageDisplayName(tierName) {
    var displayName = tierName === 'Not Sure Yet' ? "We'll help you choose" : tierName;
    if (chipName) chipName.textContent = displayName;
  }

  function setPackageChipVisible(show) {
    if (chip) chip.hidden = !show;
  }

  function formatReviewValue(value) {
    return value && String(value).trim() ? String(value).trim() : '—';
  }

  function buildReviewSummary() {
    if (!reviewSummaryEl) return;
    var startSelect = document.getElementById('event_start_time');
    var arrivalDisplay = document.getElementById('event_arrival_time_display');
    var venueChecked = document.querySelector('input[name="venue_type"]:checked');
    var tipChecked = document.querySelector('input[name="tip_jar"]:checked');
    var zipInput = document.getElementById('event_zip');
    var rows = [
      { label: 'Type of event', value: eventTypeInput ? eventTypeInput.value : '' },
      { label: 'Event date', value: dateInputLive ? dateInputLive.value : '' },
      { label: 'Venue', value: venueChecked ? venueChecked.value : '' },
      { label: 'ZIP code', value: zipInput ? zipInput.value : '' },
      { label: 'Bar start time', value: startSelect && startSelect.selectedIndex >= 0 ? startSelect.options[startSelect.selectedIndex].text : '' },
      { label: 'Arrival', value: arrivalDisplay ? arrivalDisplay.value : '' },
      { label: 'Hours of service', value: hoursInputLive ? hoursInputLive.value + ' hrs' : '' },
      { label: 'Drinking guests', value: drinkingGuestsLive ? drinkingGuestsLive.value : '' },
      { label: 'Bartenders', value: selectedBartenderCount() != null ? String(selectedBartenderCount()) : '' },
      { label: 'Tip jar', value: tipChecked ? tipChecked.value : '' },
      { label: 'Service', value: selectedTier || 'Not selected' },
      { label: 'Add-ons', value: (getSelectedAddonsSummary().labels.join(', ') || (selectedPackagePath === 'bartender' ? 'None' : '')) },
      { label: 'Name', value: document.getElementById('name') ? document.getElementById('name').value : '' },
      { label: 'Email', value: document.getElementById('email') ? document.getElementById('email').value : '' },
      { label: 'Phone', value: document.getElementById('phone') ? document.getElementById('phone').value : '' },
      { label: 'Address', value: document.getElementById('location') ? document.getElementById('location').value : '' }
    ];
    var notesVal = document.getElementById('notes') ? document.getElementById('notes').value.trim() : '';
    if (notesVal) rows.push({ label: 'Notes', value: notesVal });

    reviewSummaryEl.innerHTML = rows.map(function(row) {
      return '<div class="book-review-row"><span class="book-review-label">' + row.label + '</span><span class="book-review-value">' + formatReviewValue(row.value) + '</span></div>';
    }).join('');
  }

  function goToWizardStep(n) {
    if (n < 1 || n > BOOK_WIZARD_TOTAL) return;
    currentWizardStep = n;
    wizardPanels.forEach(function(panel) {
      var stepNum = parseInt(panel.dataset.wizardStep, 10);
      panel.hidden = stepNum !== n;
    });
    setActiveProgress(n);
    if (n === 3) updateBartenderRecommendation();
    if (n === 4) {
      syncAddonHiddenFields();
      if (window.tdrPendingPath === 'bartender') {
        delete window.tdrPendingPath;
        chooseBartenderOnly();
      } else if (window.tdrPendingPath === 'addons') {
        delete window.tdrPendingPath;
        chooseAddonsPath();
      }
    }
    if (n === 6) {
      buildReviewSummary();
      updateEstimate();
    }
    scrollToBookTop();
  }

  function commitServiceSelection(label) {
    selectedHourly = BARTENDER_HOURLY;
    selectedTier = label;
    if (tierInput) tierInput.value = label;
    if (packagePathInput) packagePathInput.value = selectedPackagePath;
    setPackageDisplayName(label);
    setPackageChipVisible(true);
    updateEstimate();
  }

  function chooseBartenderOnly() {
    selectedPackagePath = 'bartender';
    setPathButtonsActive('bartender');
    showAddonsPanel(false);
    clearAllAddons();
    commitServiceSelection('Bartender Only');
    setStep4PathSelected(true);
  }

  function chooseAddonsPath() {
    selectedPackagePath = 'addons';
    setPathButtonsActive('addons');
    showAddonsPanel(true);
    commitServiceSelection('Bartender + Add-Ons');
    setStep4PathSelected(true);
    if (addonsPanel) {
      addonsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function continueFromAddons() {
    if (selectedPackagePath === 'bartender') {
      commitServiceSelection('Bartender Only');
      goToWizardStep(5);
      return;
    }
    if (selectedPackagePath !== 'addons') {
      chooseAddonsPath();
    }
    commitServiceSelection('Bartender + Add-Ons');
    goToWizardStep(5);
  }

  function goToPackageStep() {
    goToWizardStep(4);
  }

  if (pathBartenderBtn) {
    pathBartenderBtn.addEventListener('click', function() {
      chooseBartenderOnly();
    });
  }

  if (pathAddonsBtn) {
    pathAddonsBtn.addEventListener('click', function() {
      chooseAddonsPath();
    });
  }

  document.querySelectorAll('.addons-category-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      setAddonsCategory(chip.getAttribute('data-addons-category'));
    });
  });

  if (addonsContinueBtn) {
    addonsContinueBtn.addEventListener('click', continueFromAddons);
  }

  document.querySelectorAll('.addon-card').forEach(function(card) {
    var toggle = card.querySelector('.addon-toggle');
    if (toggle) {
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        toggleAddonCard(card);
      });
    }
    card.querySelectorAll('.addon-qty-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        updateAddonQty(card, parseInt(btn.getAttribute('data-qty-delta'), 10) || 0);
      });
    });
  });

  if (changeBtn) {
    changeBtn.addEventListener('click', goToPackageStep);
  }

  progressSteps.forEach(function(el) {
    el.addEventListener('click', function() {
      var target = parseInt(el.dataset.step, 10);
      if (!el.disabled && target < currentWizardStep) {
        goToWizardStep(target);
      }
    });
  });

  window.tdrBookWizard = {
    goToStep: goToWizardStep,
    getCurrentStep: function() { return currentWizardStep; },
    updateEstimate: updateEstimate,
    updateHolidayDateHint: updateHolidayDateHint
  };

  if (hoursInputLive) {
    hoursInputLive.min = MIN_BOOKING_HOURS;
    hoursInputLive.max = MAX_BOOKING_HOURS;
    hoursInputLive.addEventListener('input', updateEstimate);
    hoursInputLive.addEventListener('change', updateEstimate);
    hoursInputLive.addEventListener('blur', function() {
      var n = parseInt(this.value, 10);
      if (!this.value || isNaN(n) || n < MIN_BOOKING_HOURS) {
        this.value = String(MIN_BOOKING_HOURS);
      } else if (n > MAX_BOOKING_HOURS) {
        this.value = String(MAX_BOOKING_HOURS);
      }
      updateEstimate();
    });
  }
  if (drinkingGuestsLive) {
    function syncDrinkingGuestsFill() {
      var min = Number(drinkingGuestsLive.min) || 0;
      var max = Number(drinkingGuestsLive.max) || 250;
      var val = Number(drinkingGuestsLive.value) || 0;
      var pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
      drinkingGuestsLive.style.background =
        'linear-gradient(to right, #C9A84C ' + pct + '%, rgba(250,247,242,0.18) ' + pct + '%)';
    }

    function syncDrinkingGuestsDisplay() {
      var display = document.getElementById('guests-drinking-display');
      var value = drinkingGuestsLive.value || '0';
      var n = parseInt(value, 10);
      if (display) {
        display.textContent = value + ' drinking guest' + (n === 1 ? '' : 's');
      }
      drinkingGuestsLive.setAttribute('aria-valuenow', value);
      syncDrinkingGuestsFill();
      updateBartenderRecommendation();
      syncAddonHiddenFields();
      updateEstimate();
    }
    drinkingGuestsLive.addEventListener('input', syncDrinkingGuestsDisplay);
    drinkingGuestsLive.addEventListener('change', syncDrinkingGuestsDisplay);
    syncDrinkingGuestsDisplay();
  }

  if (bartenderCountRadios.length) {
    bartenderCountRadios.forEach(function(radio) {
      radio.addEventListener('change', function() {
        if (bartenderCountGroup) {
          bartenderCountGroup.classList.remove('is-invalid');
        }
        updateEstimate();
      });
    });
  }

  var tierParam = new URLSearchParams(window.location.search).get('tier');
  if (tierParam) {
    var lower = tierParam.toLowerCase();
    if (lower.indexOf('bartender') !== -1 || lower === 'bartender only') {
      window.tdrPendingPath = 'bartender';
    } else if (lower.indexOf('add') !== -1 || lower === 'full bar' || lower === 'basic bar') {
      window.tdrPendingPath = 'addons';
    }
  }

  goToWizardStep(1);
}

// ---- /book page: phone number validation ----
if (document.querySelector('.book-form')) {
  var bookForm = document.querySelector('.book-form');
  var ARRIVAL_LEAD_MINUTES = 90;

  function parseTimeToMinutes(value) {
    if (!value) return null;
    var parts = value.split(':');
    if (parts.length !== 2) return null;
    var hours = parseInt(parts[0], 10);
    var mins = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(mins)) return null;
    return hours * 60 + mins;
  }

  function normalizeMinutes(totalMins) {
    var day = 24 * 60;
    return ((totalMins % day) + day) % day;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatTime12(totalMins) {
    var normalized = normalizeMinutes(totalMins);
    var hours24 = Math.floor(normalized / 60);
    var mins = normalized % 60;
    var hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    var ampm = hours24 < 12 ? 'AM' : 'PM';
    return hours12 + ':' + pad2(mins) + ' ' + ampm;
  }

  function updateArrivalTime() {
    var startSelect = document.getElementById('event_start_time');
    var wrap = document.getElementById('event-arrival-wrap');
    var display = document.getElementById('event_arrival_time_display');
    if (!startSelect || !wrap || !display) return;

    var startMins = parseTimeToMinutes(startSelect.value);
    if (startMins == null) {
      wrap.hidden = true;
      display.value = '';
      return;
    }

    var arrivalMins = startMins - ARRIVAL_LEAD_MINUTES;
    display.value = formatTime12(arrivalMins) + ' • Setup';
    wrap.hidden = false;
  }

  var startTimeSelect = document.getElementById('event_start_time');
  if (startTimeSelect) {
    startTimeSelect.addEventListener('change', updateArrivalTime);
    updateArrivalTime();
  }

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

  function toISODate(d) {
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function tomorrowISO() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODate(d);
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

  var dateError = attachFieldError(dateInput, 'Please choose a date after today.');
  var hoursError = attachFieldError(hoursInput, 'Bookings are 3–6 hours.');

  if (dateInput) {
    dateInput.min = tomorrowISO();
    dateInput.addEventListener('change', function() {
      showFieldError(this, dateError, this.value && this.value <= todayISO());
      if (window.tdrBookWizard) {
        window.tdrBookWizard.updateHolidayDateHint();
        window.tdrBookWizard.updateEstimate();
      }
    });
  }

  function hoursInvalid(requireValue) {
    if (!hoursInput) return false;
    if (!hoursInput.value) return !!requireValue;
    if (!/^[1-9]\d*$/.test(hoursInput.value.trim())) return true;
    var n = parseInt(hoursInput.value, 10);
    return n < MIN_BOOKING_HOURS || n > MAX_BOOKING_HOURS;
  }

  if (hoursInput) {
    hoursInput.min = MIN_BOOKING_HOURS;
    hoursInput.max = MAX_BOOKING_HOURS;
    hoursInput.addEventListener('input', function() {
      this.value = this.value.replace(/[^\d]/g, '');
      if (this.value === '0') this.value = '';
      showFieldError(this, hoursError, hoursInvalid(false));
    });
    hoursInput.addEventListener('blur', function() {
      var n = parseInt(this.value, 10);
      if (!this.value || isNaN(n) || n < MIN_BOOKING_HOURS) {
        this.value = String(MIN_BOOKING_HOURS);
      } else if (n > MAX_BOOKING_HOURS) {
        this.value = String(MAX_BOOKING_HOURS);
      }
      showFieldError(this, hoursError, hoursInvalid(false));
    });
  }

  var drinkingGuestsInput = document.getElementById('guests_drinking_21_plus');
  var zipInput = document.getElementById('event_zip');
  var bartenderCountField = document.querySelector('input[name="bartender_count"]');

  function drinkingGuestsInvalid() {
    if (!drinkingGuestsInput || !drinkingGuestsInput.value) return true;
    if (!/^[1-9]\d*$/.test(drinkingGuestsInput.value)) return true;
    var n = parseInt(drinkingGuestsInput.value, 10);
    return n < 5 || n > 250 || n % 5 !== 0;
  }

  var drinkingGuestsError = attachFieldError(
    drinkingGuestsInput,
    'Please choose number of drinking guests.'
  );

  function clearDrinkingGuestsError() {
    showFieldError(drinkingGuestsInput, drinkingGuestsError, false);
  }

  function validateDrinkingGuests(showErrors) {
    if (!drinkingGuestsInput) return false;
    var invalid = drinkingGuestsInvalid();
    if (showErrors) {
      showFieldError(drinkingGuestsInput, drinkingGuestsError, invalid);
    }
    return invalid;
  }

  function zipInvalid() {
    if (!zipInput || !zipInput.value.trim()) return true;
    var digits = zipInput.value.replace(/\D/g, '');
    return digits.length !== 5 && digits.length !== 9;
  }

  var zipError = attachFieldError(zipInput, 'Please enter a valid 5-digit ZIP code.');

  function validateZip(showErrors) {
    if (!zipInput) return false;
    var invalid = zipInvalid();
    if (showErrors) showFieldError(zipInput, zipError, invalid);
    return invalid;
  }

  if (zipInput) {
    zipInput.addEventListener('input', function() {
      this.value = this.value.replace(/[^\d-]/g, '').slice(0, 10);
      showFieldError(this, zipError, false);
    });
  }

  if (drinkingGuestsInput) {
    drinkingGuestsInput.addEventListener('change', function() {
      clearDrinkingGuestsError();
    });
  }

  function clearChoiceGroupError(groupId) {
    var group = document.getElementById(groupId);
    if (group) group.classList.remove('is-invalid');
  }

  document.querySelectorAll('input[name="venue_type"]').forEach(function(input) {
    input.addEventListener('change', function() {
      clearChoiceGroupError('venue-type-group');
    });
  });

  document.querySelectorAll('input[name="tip_jar"]').forEach(function(input) {
    input.addEventListener('change', function() {
      clearChoiceGroupError('tip-jar-group');
    });
  });

  if (window.tdrBookWizard) {
    var eventTypeField = document.getElementById('event_type');
    var startTimeField = document.getElementById('event_start_time');

    function focusFirstInvalid(fields) {
      for (var i = 0; i < fields.length; i++) {
        if (!fields[i].checkValidity()) {
          fields[i].reportValidity();
          fields[i].focus();
          return true;
        }
      }
      return false;
    }

    function venueTypeSelected() {
      return !!document.querySelector('input[name="venue_type"]:checked');
    }

    function tipJarSelected() {
      return !!document.querySelector('input[name="tip_jar"]:checked');
    }

    function validateWizardStep1() {
      if (!eventTypeField || !eventTypeField.value) {
        if (eventTypeField) {
          eventTypeField.focus();
          eventTypeField.reportValidity();
        }
        return false;
      }
      if (!dateInput || !dateInput.value) {
        if (dateInput) {
          dateInput.focus();
          dateInput.reportValidity();
        }
        return false;
      }
      if (dateInput.value <= todayISO()) {
        showFieldError(dateInput, dateError, true);
        dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dateInput.focus();
        return false;
      }
      showFieldError(dateInput, dateError, false);
      if (!venueTypeSelected()) {
        var venueGroup = document.getElementById('venue-type-group');
        if (venueGroup) {
          venueGroup.classList.add('is-invalid');
          venueGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
      if (validateZip(true)) {
        zipInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        zipInput.focus();
        return false;
      }
      return true;
    }

    function validateWizardStep2() {
      if (startTimeField && !startTimeField.value) {
        startTimeField.focus();
        startTimeField.reportValidity();
        return false;
      }
      if (hoursInvalid(true)) {
        showFieldError(hoursInput, hoursError, true);
        hoursInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hoursInput.focus();
        return false;
      }
      return true;
    }

    function validateWizardStep3() {
      if (validateDrinkingGuests(true)) {
        drinkingGuestsInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        drinkingGuestsInput.focus();
        return false;
      }
      if (!getBartenderCountRadio()) {
        if (bartenderCountGroup) {
          bartenderCountGroup.classList.add('is-invalid');
          bartenderCountGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (bartenderCountField) bartenderCountField.focus();
        return false;
      }
      if (!tipJarSelected()) {
        var tipGroup = document.getElementById('tip-jar-group');
        if (tipGroup) {
          tipGroup.classList.add('is-invalid');
          tipGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
      return true;
    }

    function validateWizardStep5() {
      var step5 = document.getElementById('book-wizard-step-5');
      if (!step5) return false;
      var requiredFields = step5.querySelectorAll('input[required]');
      if (focusFirstInvalid(requiredFields)) return false;
      if (phoneInput) {
        var digits = phoneInput.value.replace(/\D/g, '');
        if (digits.length !== 10) {
          phoneError.style.display = 'block';
          phoneInput.style.borderColor = '#E24B4A';
          phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          phoneInput.focus();
          return false;
        }
      }
      return true;
    }

    document.querySelectorAll('.book-wizard-next').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var next = parseInt(btn.getAttribute('data-next'), 10);
        var current = window.tdrBookWizard.getCurrentStep();
        if (current === 1 && !validateWizardStep1()) return;
        if (current === 2 && !validateWizardStep2()) return;
        if (current === 3 && !validateWizardStep3()) return;
        if (current === 5 && !validateWizardStep5()) return;
        window.tdrBookWizard.goToStep(next);
      });
    });

    document.querySelectorAll('.book-wizard-back').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var back = parseInt(btn.getAttribute('data-back'), 10);
        window.tdrBookWizard.goToStep(back);
      });
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

    if (dateInput && dateInput.value && dateInput.value <= todayISO()) {
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

    if (validateDrinkingGuests(true)) {
      drinkingGuestsInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      drinkingGuestsInput.focus();
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
    if (!el) return;
    if (param === 'date') {
      var now = new Date();
      var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      if (val <= today) return;
    }
    el.value = val;
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
const tickerWrap = document.querySelector('.ticker-wrap');
const isHomeHero = document.querySelector('.hero') && tickerWrap;

function updateNavOverHero() {
  if (!header || !isHomeHero) return;
  var pastTicker = tickerWrap.getBoundingClientRect().bottom <= 0;
  header.classList.toggle('nav-over-hero', !pastTicker);
}

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
  updateNavOverHero();
}

window.addEventListener('scroll', updateNavTheme, { passive: true });
updateNavTheme(); // run once on load
updateNavOverHero();

// ---- Scroll-away nav (homepage, careers, book, about, packages) ----
if (document.querySelector('.hero') || document.querySelector('.careers-body') || document.querySelector('.book-form') || document.querySelector('.about-body') || document.querySelector('.pkg-page') || document.querySelector('.menu-body')) {
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

// ---- /book location: Google Places Autocomplete ----
window.initBookPlacesAutocomplete = function initBookPlacesAutocomplete() {
  var input = document.getElementById('location');
  if (!input || !window.google || !google.maps || !google.maps.places) return;
  if (input.dataset.placesReady === '1') return;
  input.dataset.placesReady = '1';

  var autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ['formatted_address', 'name', 'place_id', 'geometry'],
    componentRestrictions: { country: ['us'] }
  });

  // Bias toward NYC / Long Island / nearby NJ (not strict — other US addresses still work)
  autocomplete.setBounds(new google.maps.LatLngBounds(
    { lat: 40.45, lng: -74.35 },
    { lat: 41.25, lng: -71.75 }
  ));

  autocomplete.addListener('place_changed', function() {
    var place = autocomplete.getPlace();
    if (!place) return;
    if (place.formatted_address) {
      input.value = place.formatted_address;
    } else if (place.name) {
      input.value = place.name;
    }
  });
};

if (window.google && google.maps && google.maps.places) {
  window.initBookPlacesAutocomplete();
}
