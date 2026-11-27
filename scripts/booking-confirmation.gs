/**
 * Booking receipt for The Drink Is Right
 *
 * In script.google.com: Select all in Code.gs, delete, paste THIS WHOLE FILE,
 * Save, then run installTrigger.
 */

var BOOKING_SUBJECT = 'New Booking Inquiry — The Drink Is Right';
var FROM_ADDRESS = 'info@thedrinkisright.com';
var FROM_NAME = 'The Drink Is Right';
var RECEIPT_SUBJECT = 'We have your request';
var SENT_LABEL = 'TDIR/Receipt sent';
var SKIPPED_LABEL = 'TDIR/Receipt skipped';

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function receiptsAfterMs() {
  var props = PropertiesService.getScriptProperties();
  var stored = props.getProperty('receiptsAfterMs');
  if (stored) return parseInt(stored, 10);
  var now = Date.now();
  props.setProperty('receiptsAfterMs', String(now));
  return now;
}

function inquirySearchQuery(includeSkipped) {
  var query = [
    '(from:formspree OR subject:"Booking Inquiry")',
    '-label:"' + SENT_LABEL + '"'
  ];
  if (!includeSkipped) query.push('-label:"' + SKIPPED_LABEL + '"');
  return query.join(' ');
}

function ignoreExistingInquiries() {
  var skippedLabel = getOrCreateLabel(SKIPPED_LABEL);
  var cutoff = Date.now() - 60 * 60 * 1000;
  var query = inquirySearchQuery(false);
  for (var i = 0; i < 20; i++) {
    var threads = GmailApp.search(query, 0, 50);
    if (!threads.length) break;
    var labeled = 0;
    threads.forEach(function (thread) {
      var message = thread.getMessages()[0];
      if (!message) return;
      if (message.getDate().getTime() >= cutoff) return;
      thread.addLabel(skippedLabel);
      labeled++;
    });
    if (!labeled) break;
  }
}

function installTrigger() {
  PropertiesService.getScriptProperties().setProperty(
    'receiptsAfterMs',
    String(Date.now())
  );
  ignoreExistingInquiries();

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendBookingReceipts') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('sendBookingReceipts')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function sendBookingReceipts() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  try {
    processInquiryThreads(GmailApp.search(inquirySearchQuery(false), 0, 20), false);
  } finally {
    lock.releaseLock();
  }
}

function sendForLatestInquiry() {
  var threads = GmailApp.search(inquirySearchQuery(true), 0, 5);
  if (!threads.length) {
    throw new Error('No Formspree booking email found in this inbox.');
  }
  processInquiryThreads([threads[0]], true);
}

function debugLastInquiry() {
  var threads = GmailApp.search(inquirySearchQuery(true) + ' newer_than:2d', 0, 5);
  if (!threads.length) {
    Logger.log('No Formspree / Booking Inquiry emails found.');
    return;
  }
  threads.forEach(function (thread, i) {
    var message = thread.getMessages()[0];
    var labels = thread.getLabels().map(function (label) {
      return label.getName();
    }).join(', ');
    Logger.log('--- ' + (i + 1) + ' ---');
    Logger.log('Subject: ' + message.getSubject());
    Logger.log('From: ' + message.getFrom());
    Logger.log('Date: ' + message.getDate());
    Logger.log('Labels: ' + labels);
    Logger.log('Extracted client email: ' + (extractClientEmail(message) || '(none)'));
    Logger.log('Details sentence: ' + (detailsSentence(extractInquiryDetails(message)) || '(generic)'));
    Logger.log('Plain snippet: ' + htmlToText(message.getPlainBody() || message.getBody()).slice(0, 400));
  });
}

function processInquiryThreads(threads, force) {
  var sentLabel = getOrCreateLabel(SENT_LABEL);
  var skippedLabel = getOrCreateLabel(SKIPPED_LABEL);
  var cutoff = receiptsAfterMs() - 2 * 60 * 60 * 1000;

  threads.forEach(function (thread) {
    var message = thread.getMessages()[0];
    if (!message || message.isDraft()) return;
    if (!force && message.getDate().getTime() < cutoff) {
      thread.addLabel(skippedLabel);
      return;
    }
    var alreadySent = thread.getLabels().some(function (label) {
      return label.getName() === SENT_LABEL;
    });
    if (alreadySent) return;
    var clientEmail = extractClientEmail(message);
    var details = extractInquiryDetails(message);
    Logger.log('Subject: ' + message.getSubject());
    Logger.log('Client email: ' + (clientEmail || '(none)'));
    Logger.log('Details sentence: ' + (detailsSentence(details) || '(generic)'));
    if (!clientEmail) {
      thread.addLabel(skippedLabel);
      return;
    }
    sendReceipt(clientEmail, details);
    thread.addLabel(sentLabel);
  });
}

function testSendReceipt() {
  sendReceipt(Session.getActiveUser().getEmail());
}

function sendReceipt(to, details) {
  var options = {
    name: FROM_NAME,
    replyTo: FROM_ADDRESS,
    htmlBody: receiptHtml(details)
  };
  try {
    options.from = FROM_ADDRESS;
    GmailApp.sendEmail(to, RECEIPT_SUBJECT, receiptPlainText(details), options);
  } catch (err) {
    delete options.from;
    GmailApp.sendEmail(to, RECEIPT_SUBJECT, receiptPlainText(details), options);
  }
}

function extractClientEmail(message) {
  var raw = message.getBody() + '\n' + message.getPlainBody();
  var text = htmlToText(raw);
  var fieldMatch = text.match(/\bemail\s*[:\n\s]+([^\s<>]+@[^\s<>]+)/i);
  if (fieldMatch && isClientEmail(fieldMatch[1])) {
    return fieldMatch[1].replace(/[.,;:]+$/, '').toLowerCase();
  }
  var emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  for (var i = 0; i < emails.length; i++) {
    var address = emails[i].replace(/[.,;:]+$/, '').toLowerCase();
    if (isClientEmail(address)) return address;
  }
  return '';
}

function isClientEmail(address) {
  if (!address) return false;
  var lower = address.toLowerCase();
  if (lower.indexOf('formspree') !== -1) return false;
  if (lower.indexOf('thedrinkisright.com') !== -1) return false;
  return true;
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|td|th|h[1-6]|li)>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&#8211;/g, '\u2013')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function extractField(text, keys) {
  var normalized = String(text || '').replace(/\r/g, '');
  for (var i = 0; i < keys.length; i++) {
    var escaped = keys[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    var patterns = [
      new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\n\\s*([^\\n]+)', 'i'),
      new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*[:\\-\\u2013]\\s*([^\\n]+)', 'i'),
      new RegExp('(?:^|\\n)\\s*' + escaped + '\\s{2,}([^\\n]+)', 'i')
    ];
    for (var p = 0; p < patterns.length; p++) {
      var match = normalized.match(patterns[p]);
      if (!match) continue;
      var value = String(match[1] || '').replace(/\s+/g, ' ').trim();
      if (value && !isFieldLabel(value)) return value;
    }
  }
  return '';
}

function isFieldLabel(value) {
  return /^(name|email|phone|event_type|event_date|event_start_time|event_hours|guests|location|notes|service_tier|estimated_total|estimate_breakdown|bartender_count|holiday_upcharge|arrival_time|_subject|_gotcha)$/i.test(value);
}

function extractInquiryDetails(message) {
  var text = htmlToText((message && message.getBody ? message.getBody() : '') + '\n' + (message && message.getPlainBody ? message.getPlainBody() : ''));
  return {
    occasion: extractField(text, ['event_type', 'Occasion']),
    date: extractField(text, ['event_date', 'Date']),
    startTime: extractField(text, ['event_start_time', 'Start Time']),
    hours: extractField(text, ['event_hours', 'Hours']),
    guests: extractField(text, ['guests', 'Total guest count'])
  };
}

function occasionPhrase(occasion) {
  var raw = String(occasion || '').replace(/\s+/g, ' ').trim();
  if (!raw || /^select one$/i.test(raw)) return '';
  var phrases = {
    'birthday party': 'a birthday party',
    'engagement': 'an engagement',
    'wedding': 'a wedding',
    'rehearsal dinner': 'a rehearsal dinner',
    'retirement party': 'a retirement party',
    'anniversary': 'an anniversary',
    'corporate event': 'a corporate event',
    'bridal shower': 'a bridal shower',
    'house party': 'a house party',
    'graduation party': 'a graduation party',
    'other': 'an event'
  };
  var mapped = phrases[raw.toLowerCase()];
  if (mapped) return mapped;
  var noun = raw.toLowerCase();
  var first = noun.replace(/[^a-z]/g, '').charAt(0);
  if (!first) return '';
  return ('aeiou'.indexOf(first) !== -1 ? 'an ' : 'a ') + noun;
}

function formatEventDate(raw) {
  var value = String(raw || '').trim();
  if (!value || /^select a date$/i.test(value)) return '';
  var iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return value;
  var months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  var month = months[parseInt(iso[2], 10) - 1];
  if (!month) return '';
  return month + ' ' + parseInt(iso[3], 10) + ', ' + iso[1];
}

function formatStartTime(raw) {
  var value = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!value || /^select a time$/i.test(value)) return '';
  return value;
}

function formatHoursPhrase(raw) {
  var n = parseInt(String(raw || '').replace(/[^\d]/g, ''), 10);
  if (!n) return '';
  return n === 1 ? '1 hour' : n + ' hours';
}

function formatGuestsPhrase(raw) {
  var value = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (/^up to 25$/i.test(value)) return 'up to 25 guests';
  if (/guests$/i.test(value)) return value.charAt(0).toLowerCase() + value.slice(1);
  return value + ' guests';
}

function detailsSentence(details) {
  if (!details) return '';
  var occasion = occasionPhrase(details.occasion);
  var date = formatEventDate(details.date);
  var time = formatStartTime(details.startTime);
  var hours = formatHoursPhrase(details.hours);
  var guests = formatGuestsPhrase(details.guests);
  if (!occasion && !date && !time && !hours && !guests) return '';

  var sentence = 'We received your request for ' + (occasion || 'an event');
  if (date) sentence += ' on ' + date;
  if (time) sentence += ' at ' + time;
  var scope = [];
  if (hours) scope.push(hours);
  if (guests) scope.push(guests);
  if (scope.length) sentence += ' \u2014 ' + scope.join(', ');
  return sentence + '.';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function receiptCopy(details) {
  var sentence = detailsSentence(details);
  return {
    details: sentence,
    followUp: sentence
      ? 'We typically respond within 24 hours.'
      : 'We received your booking request and typically respond within 24 hours.'
  };
}

function receiptPlainText(details) {
  var copy = receiptCopy(details);
  var lines = ["We'll be in touch.", ''];
  if (copy.details) {
    lines.push(copy.details);
    lines.push('');
  }
  lines.push(copy.followUp);
  lines.push('');
  lines.push('The Drink Is Right');
  lines.push('New York City');
  return lines.join('\n');
}

function receiptHtml(details) {
  var copy = receiptCopy(details);
  var body = '';
  if (copy.details) {
    body += '<tr><td style="padding-top:22px;font-family:Georgia,Times,serif;font-size:16px;line-height:1.65;color:#5C5854;">' +
      escapeHtml(copy.details) +
      '</td></tr>';
    body += '<tr><td style="padding-top:18px;font-family:Georgia,Times,serif;font-size:16px;line-height:1.65;color:#5C5854;">' +
      escapeHtml(copy.followUp) +
      '</td></tr>';
  } else {
    body += '<tr><td style="padding-top:22px;font-family:Georgia,Times,serif;font-size:16px;line-height:1.65;color:#5C5854;">' +
      escapeHtml(copy.followUp) +
      '</td></tr>';
  }
  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F0E8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F0E8;padding:48px 16px;">' +
      '<tr><td align="center">' +
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;padding:56px 44px;">' +
          '<tr><td style="font-family:Georgia,Times,serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#C9A84C;">The Drink Is Right</td></tr>' +
          '<tr><td style="padding-top:28px;font-family:Georgia,Times,serif;font-size:28px;line-height:1.3;color:#161414;">We\'ll be in touch.</td></tr>' +
          '<tr><td style="padding-top:18px;">' +
            '<div style="width:40px;height:1px;background:#C9A84C;line-height:1px;font-size:1px;">&nbsp;</div>' +
          '</td></tr>' +
          body +
          '<tr><td style="padding-top:40px;font-family:Georgia,Times,serif;font-size:15px;line-height:1.6;color:#161414;">The Drink Is Right<br><span style="color:#8A8680;font-size:13px;">New York City</span></td></tr>' +
        '</table>' +
      '</td></tr>' +
    '</table>' +
    '</body></html>';
}
