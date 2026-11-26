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

function ignoreExistingInquiries() {
  var skippedLabel = getOrCreateLabel(SKIPPED_LABEL);
  var query = [
    'subject:"' + BOOKING_SUBJECT + '"',
    '-label:"' + SENT_LABEL + '"',
    '-label:"' + SKIPPED_LABEL + '"'
  ].join(' ');
  for (var i = 0; i < 20; i++) {
    var threads = GmailApp.search(query, 0, 50);
    if (!threads.length) break;
    threads.forEach(function (thread) {
      thread.addLabel(skippedLabel);
    });
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
    var sentLabel = getOrCreateLabel(SENT_LABEL);
    var skippedLabel = getOrCreateLabel(SKIPPED_LABEL);
    var query = [
      'subject:"' + BOOKING_SUBJECT + '"',
      '-label:"' + SENT_LABEL + '"',
      '-label:"' + SKIPPED_LABEL + '"'
    ].join(' ');
    var threads = GmailApp.search(query, 0, 20);

    threads.forEach(function (thread) {
      var message = thread.getMessages()[0];
      if (!message || message.isDraft()) return;
      if (message.getDate().getTime() <= receiptsAfterMs()) {
        thread.addLabel(skippedLabel);
        return;
      }
      var clientEmail = extractClientEmail(message);
      if (!clientEmail) {
        thread.addLabel(skippedLabel);
        return;
      }
      sendReceipt(clientEmail);
      thread.addLabel(sentLabel);
    });
  } finally {
    lock.releaseLock();
  }
}

function testSendReceipt() {
  sendReceipt(Session.getActiveUser().getEmail());
}

function sendReceipt(to) {
  var options = {
    name: FROM_NAME,
    replyTo: FROM_ADDRESS,
    htmlBody: receiptHtml()
  };
  try {
    options.from = FROM_ADDRESS;
    GmailApp.sendEmail(to, RECEIPT_SUBJECT, receiptPlainText(), options);
  } catch (err) {
    delete options.from;
    GmailApp.sendEmail(to, RECEIPT_SUBJECT, receiptPlainText(), options);
  }
}

function extractClientEmail(message) {
  var raw = message.getBody() + '\n' + message.getPlainBody();
  var text = htmlToText(raw);
  var fieldMatch = text.match(/(?:^|\n)\s*email\s*[:\n]\s*([^\s<>]+@[^\s<>]+)/i);
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
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function receiptPlainText() {
  return [
    "We'll be in touch.",
    '',
    'We received your booking request and typically respond within 24 hours.',
    '',
    'The Drink Is Right',
    'New York City'
  ].join('\n');
}

function receiptHtml() {
  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F0E8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F0E8;padding:48px 16px;">' +
      '<tr><td align="center">' +
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;padding:56px 44px;">' +
          '<tr><td style="font-family:Georgia,Times,serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#C9A84C;">The Drink Is Right</td></tr>' +
          '<tr><td style="padding-top:28px;font-family:Georgia,Times,serif;font-size:28px;line-height:1.3;color:#161414;">We\'ll be in touch.</td></tr>' +
          '<tr><td style="padding-top:18px;">' +
            '<div style="width:40px;height:1px;background:#C9A84C;line-height:1px;font-size:1px;">&nbsp;</div>' +
          '</td></tr>' +
          '<tr><td style="padding-top:22px;font-family:Georgia,Times,serif;font-size:16px;line-height:1.65;color:#5C5854;">We received your booking request and typically respond within 24 hours.</td></tr>' +
          '<tr><td style="padding-top:40px;font-family:Georgia,Times,serif;font-size:15px;line-height:1.6;color:#161414;">The Drink Is Right<br><span style="color:#8A8680;font-size:13px;">New York City</span></td></tr>' +
        '</table>' +
      '</td></tr>' +
    '</table>' +
    '</body></html>';
}
