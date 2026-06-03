/**
 * Persian Calendar Integration for Jira
 * Version 1.1 - With Detailed Logging
 * Replaces the default Gregorian date picker with Persian/Shamsi calendar
 * Stores data in Gregorian format
 */

(function () {
    'use strict';

    // Workaround for Jira React 18 feature gate error ("Client must be initialized before using this method")
    window.__CRITERION__ = window.__CRITERION__ || { getFeatureFlagOverride: function() { return false; } };
    window.CRITERION = window.CRITERION || { getFeatureFlagOverride: function() { return false; } };

    // ========== LOGGING SYSTEM ==========
    var PC_LOG_PREFIX = '[PC-PERSIAN-CALENDAR]';
    var PC_VERSION = '11.4.21';
    console.log(PC_LOG_PREFIX + ' Version ' + PC_VERSION + ' loaded.');

    // IMMEDIATE GLOBAL CLICK DIAGNOSTIC (Writen to F12 Console)
    window.addEventListener('click', function(e) {
        var t = e.target;
        var classes = t.className || '';
        var id = t.id || '';
        console.log('[PC-DIAGNOSTIC-CLICK]', {
            tagName: t.tagName,
            id: id,
            className: classes,
            element: t
        });
    }, true);

    // ========== SERVER-SIDE LOG SENDING ==========
    var _serverLogQueue = [];
    var _serverLogSending = false;
    var _serverLogSentKeys = {};  // Deduplication: avoid sending same error repeatedly
    var _serverLogCount = 0;
    var _serverLogMaxPerSession = 50; // Max logs per page load to prevent flooding

    /**
     * Sends a log entry to the Jira server backend.
     * Logs are written to atlassian-jira.log for admin diagnosis.
     * @param {string} level - 'ERROR', 'WARN', 'INFO'
     * @param {string} message - Log message
     * @param {string} [stack] - Stack trace (optional)
     * @param {string} [component] - Component name (optional)
     */
    function sendLogToServer(level, message, stack, component) {
        // Rate limit: don't send more than _serverLogMaxPerSession per page load
        if (_serverLogCount >= _serverLogMaxPerSession) return;

        // Deduplication: skip if we already sent this exact message
        var dedupKey = level + '|' + message;
        if (_serverLogSentKeys[dedupKey]) return;
        _serverLogSentKeys[dedupKey] = true;
        _serverLogCount++;

        var payload = {
            level: level || 'INFO',
            message: (message || '').substring(0, 2000),
            stack: (stack || '').substring(0, 2000),
            url: window.location.href,
            userAgent: navigator.userAgent,
            component: component || 'persian-calendar',
            pluginVersion: PC_VERSION
        };

        _serverLogQueue.push(payload);
        _flushServerLogQueue();
    }

    function _flushServerLogQueue() {
        if (_serverLogSending || _serverLogQueue.length === 0) return;
        _serverLogSending = true;

        var payload = _serverLogQueue.shift();
        var contextPath = '';
        try {
            if (typeof AJS !== 'undefined' && AJS.contextPath) {
                contextPath = AJS.contextPath();
            }
        } catch (e) { /* ignore */ }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', contextPath + '/rest/persian-calendar/1.0/client-log', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        // XSRF token for Jira security
        try {
            var token = document.querySelector('meta[name="ajs-atl-token"]');
            if (token) {
                xhr.setRequestHeader('X-Atlassian-Token', token.getAttribute('content'));
            } else {
                xhr.setRequestHeader('X-Atlassian-Token', 'no-check');
            }
        } catch (e) {
            xhr.setRequestHeader('X-Atlassian-Token', 'no-check');
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                _serverLogSending = false;
                // Process next item in queue
                if (_serverLogQueue.length > 0) {
                    setTimeout(_flushServerLogQueue, 200); // Small delay between sends
                }
            }
        };

        try {
            xhr.send(JSON.stringify(payload));
        } catch (e) {
            _serverLogSending = false;
            // Silently fail - we don't want logging to break the plugin
        }
    }

    // ========== CORE LOGGING FUNCTIONS ==========
    function pcLog(level, message, data) {
        var timestamp = new Date().toISOString();
        var logEntry = timestamp + ' ' + PC_LOG_PREFIX + ' [' + level + '] ' + message;
        if (data !== undefined) {
            logEntry += ' | Data: ' + JSON.stringify(data);
        }

        switch (level) {
            case 'ERROR':
                console.error(logEntry);
                // Auto-send errors to server
                sendLogToServer('ERROR', message, data ? JSON.stringify(data) : '', 'pcLog');
                break;
            case 'WARN':
                console.warn(logEntry);
                // Auto-send warnings to server
                sendLogToServer('WARN', message, data ? JSON.stringify(data) : '', 'pcLog');
                break;
            case 'DEBUG':
                console.debug(logEntry);
                break;
            default:
                console.log(logEntry);
        }
        return logEntry;
    }

    function logInfo(msg, data) { return pcLog('INFO', msg, data); }
    function logDebug(msg, data) { return pcLog('DEBUG', msg, data); }
    function logWarn(msg, data) { return pcLog('WARN', msg, data); }
    function logError(msg, data) { return pcLog('ERROR', msg, data); }

    // ========== GLOBAL ERROR HANDLERS (catch unhandled JS errors) ==========
    window.addEventListener('error', function (event) {
        var msg = (event.message || 'Unknown error');
        if (event.filename) {
            msg += ' at ' + event.filename + ':' + event.lineno + ':' + event.colno;
        }
        sendLogToServer('ERROR', msg, event.error ? event.error.stack : '', 'window.onerror');
    });

    window.addEventListener('unhandledrejection', function (event) {
        var reason = '';
        try {
            reason = event.reason ? (event.reason.message || String(event.reason)) : 'Unknown rejection';
        } catch (e) {
            reason = 'Unhandled Promise Rejection';
        }
        sendLogToServer('ERROR', 'Unhandled Promise Rejection: ' + reason, '', 'Promise');
    });

    logInfo('Server-side logging system initialized. Errors will be sent to atlassian-jira.log');

    function setElementValueSafely(element, val) {
        if (!element) return;
        try {
            var nativeInputValueSetter = null;
            var proto = element;
            while (proto) {
                var desc = Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && desc.set) {
                    nativeInputValueSetter = desc.set;
                    break;
                }
                proto = Object.getPrototypeOf(proto);
            }
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(element, val);
            } else {
                element.value = val;
            }
        } catch (e) {
            logError('Error in setElementValueSafely: ' + e);
            try {
                element.value = val;
            } catch (err) {}
        }
    }

    // ========== LICENSE SYSTEM ==========
    // Security: Obfuscated integrity verification
    var _0x4f2a = ['\x65\x6e\x61\x62\x6c\x65\x64', '\x73\x74\x61\x74\x75\x73'];
    var _pcv = function () { return String.fromCharCode(80, 67, 50, 48, 50, 52); };
    var _chk = function () { return _pcv() === 'PC2024'; };

    var LICENSE_CACHE = {
        checked: false,
        enabled: false,  // Default to disabled (fail-closed)
        status: 'UNKNOWN',
        message: 'در حال بررسی وضعیت لایسنس...',
        daysRemaining: 0,
        _v: _chk  // Hidden verification function
    };

    // Integrity check function (obfuscated)
    function _pcIntegrity() {
        try {
            if (typeof LICENSE_CACHE._v !== 'function') return false;
            if (!LICENSE_CACHE._v()) return false;
            if (_0x4f2a.length !== 2) return false;
            return true;
        } catch (e) { return false; }
    }

    function checkLicenseStatus(callback) {
        // Security: Verify code integrity first
        if (!_pcIntegrity()) {
            LICENSE_CACHE.checked = true;
            LICENSE_CACHE.enabled = false;
            LICENSE_CACHE.message = 'خطای امنیتی: کد دستکاری شده';
            callback(LICENSE_CACHE);
            return;
        }

        // Always check fresh (no cache) - ensures license changes take effect immediately
        var baseUrl = AJS && AJS.contextPath ? AJS.contextPath() : '';
        var apiUrl = baseUrl + '/rest/persian-calendar/1.0/license/status';

        logInfo('Checking license status...');

        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', apiUrl, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            var data = JSON.parse(xhr.responseText);
                            LICENSE_CACHE.checked = true;
                            LICENSE_CACHE.enabled = data.enabled !== false;
                            LICENSE_CACHE.status = data.status || 'UNKNOWN';
                            LICENSE_CACHE.message = data.message || '';
                            LICENSE_CACHE.daysRemaining = data.daysRemaining || 0;
                            logInfo('License status: ' + LICENSE_CACHE.status, LICENSE_CACHE);
                        } catch (e) {
                            logWarn('Failed to parse license response');
                            LICENSE_CACHE.checked = true;
                            LICENSE_CACHE.enabled = false; // Fail-closed for parse errors
                        }
                    } else {
                        logWarn('License check failed (status ' + xhr.status + ')');
                        LICENSE_CACHE.checked = true;
                        LICENSE_CACHE.enabled = false; // Fail-closed for network errors
                    }
                    callback(LICENSE_CACHE);
                }
            };
            xhr.send();
        } catch (e) {
            logError('License check error: ' + e.message);
            LICENSE_CACHE.checked = true;
            LICENSE_CACHE.enabled = false; // Fail-closed for errors
            callback(LICENSE_CACHE);
        }
    }

    function showLicenseExpiredMessage() {
        var overlay = document.createElement('div');
        overlay.className = 'pc-overlay';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        document.body.appendChild(overlay);

        var popup = document.createElement('div');
        popup.className = 'pc-popup react-datepicker-ignore-onclickoutside';
        popup.style.textAlign = 'center';
        popup.style.padding = '30px';

        var titleNode = document.createElement('h3');
        titleNode.style.color = '#de350b';
        titleNode.style.marginBottom = '15px';
        titleNode.textContent = '⚠️ لایسنس منقضی شده';

        var messageNode = document.createElement('p');
        messageNode.style.marginBottom = '20px';
        messageNode.textContent = LICENSE_CACHE.message || 'لطفاً با پشتیبانی تماس بگیرید.';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'pc-close-btn';
        closeBtn.style.background = '#0052cc';
        closeBtn.style.color = '#fff';
        closeBtn.style.border = 'none';
        closeBtn.style.padding = '10px 20px';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.textContent = 'بستن';

        popup.appendChild(titleNode);
        popup.appendChild(messageNode);
        popup.appendChild(closeBtn);
        document.body.appendChild(popup);

        var rect = document.body.getBoundingClientRect();
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';

        popup.querySelector('.pc-close-btn').addEventListener('click', function () {
            popup.remove();
            overlay.remove();
        });
        overlay.addEventListener('click', function () {
            popup.remove();
            overlay.remove();
        });
    }

    // ========== DOM ANALYSIS ==========
    function analyzePageForDateElements() {
        logInfo('=== Starting Page Analysis ===');
        logInfo('Current URL: ' + window.location.href);
        logInfo('Page Title: ' + document.title);

        // Check for date-related inputs
        var allInputs = document.querySelectorAll('input');
        var dateInputs = [];
        allInputs.forEach(function (inp) {
            var id = inp.id || '';
            var name = inp.name || '';
            var cls = inp.className || '';
            if (id.toLowerCase().indexOf('date') !== -1 ||
                name.toLowerCase().indexOf('date') !== -1 ||
                cls.toLowerCase().indexOf('date') !== -1) {
                dateInputs.push({
                    id: id,
                    name: name,
                    class: cls,
                    type: inp.type,
                    value: inp.value
                });
            }
        });
        logInfo('Found date-related inputs: ' + dateInputs.length, dateInputs);

        // Check for duedate specifically
        var duedateInputs = document.querySelectorAll('input#duedate, input[name="duedate"], input[id*="duedate"]');
        logInfo('Found duedate inputs: ' + duedateInputs.length);
        duedateInputs.forEach(function (inp, idx) {
            logDebug('Duedate input #' + idx, {
                id: inp.id,
                name: inp.name,
                class: inp.className,
                value: inp.value,
                visible: inp.offsetParent !== null,
                parentClass: inp.parentElement ? inp.parentElement.className : 'N/A'
            });
        });

        // Check for calendar-related classes
        var calendarElements = document.querySelectorAll('[class*="calendar"], [class*="date-picker"], .aui-date-picker');
        logInfo('Found calendar-related elements: ' + calendarElements.length);

        // Check for search page specific elements
        var searchElements = document.querySelectorAll('.navigator-search, .search-options, .criteria-selector, .date-range');
        logInfo('Found search-related elements: ' + searchElements.length);
        if (searchElements.length > 0) {
            logInfo('This appears to be a SEARCH page');
            searchElements.forEach(function (el, idx) {
                logDebug('Search element #' + idx, {
                    class: el.className,
                    id: el.id,
                    childInputs: el.querySelectorAll('input').length
                });
            });
        }

        logInfo('=== Page Analysis Complete ===');
    }

    // Wait for AJS and jQuery
    // Wait for AJS and jQuery and DOM Ready
    function waitForJira(callback) {
        logDebug('Waiting for Jira framework...');
        if (typeof AJS !== 'undefined' && AJS.toInit) {
            logInfo('Found AJS framework (using toInit)');
            AJS.toInit(function () {
                callback(AJS.$);
            });
        } else if (typeof jQuery !== 'undefined') {
            logInfo('Found jQuery (using document.ready)');
            jQuery(document).ready(function () {
                callback(jQuery);
            });
        } else {
            logDebug('Framework not ready, retrying in 100ms...');
            setTimeout(function () { waitForJira(callback); }, 100);
        }
    }

    // Persian month names
    var PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    var PERSIAN_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    var GREGORIAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Official Iranian Holidays (1403 - 1407)
    // Format: 'YYYY-MM-DD': 'Occasion Name'
    var IRAN_HOLIDAYS = {
        // 1403
        '1403-1-1': 'عید نوروز', '1403-1-2': 'عید نوروز', '1403-1-3': 'عید نوروز', '1403-1-4': 'عید نوروز', '1403-1-12': 'روز جمهوری اسلامی', '1403-1-13': 'شهادت حضرت علی (ع) و روز طبیعت', '1403-1-22': 'عید سعید فطر', '1403-1-23': 'تعطیل به مناسبت عید سعید فطر',
        '1403-2-15': 'شهادت امام جعفر صادق (ع)',
        '1403-3-14': 'رحلت حضرت امام خمینی (ره)', '1403-3-15': 'قیام خونین ۱۵ خرداد', '1403-3-28': 'عید سعید قربان',
        '1403-4-5': 'عید سعید غدیر خم', '1403-4-25': 'تاسوعای حسینی', '1403-4-26': 'عاشورای حسینی',
        '1403-6-4': 'اربعین حسینی', '1403-6-12': 'رحلت حضرت رسول اکرم (ص) و شهادت حضرت امام حسن مجتبی (ع)', '1403-6-14': 'شهادت امام رضا (ع)', '1403-6-22': 'شهادت امام حسن عسکری (ع)',
        '1403-9-15': 'شهادت حضرت فاطمه زهرا (س)',
        '1403-10-25': 'ولادت حضرت امام علی (ع) و روز پدر',
        '1403-11-9': 'مبعث رسول اکرم (ص)', '1403-11-22': 'پیروزی انقلاب اسلامی', '1403-11-26': 'ولادت حضرت ولی عصر (عج)',
        '1403-12-29': 'روز ملی شدن صنعت نفت ایران',
        // 1404
        '1404-1-1': 'عید نوروز', '1404-1-2': 'عید نوروز و شهادت حضرت علی (ع)', '1404-1-3': 'عید نوروز', '1404-1-4': 'عید نوروز', '1404-1-11': 'عید سعید فطر', '1404-1-12': 'تعطیل به مناسبت عید فطر و روز جمهوری اسلامی', '1404-1-13': 'روز طبیعت',
        '1404-2-4': 'شهادت امام جعفر صادق (ع)',
        '1404-3-14': 'رحلت حضرت امام خمینی (ره)', '1404-3-15': 'قیام ۱۵ خرداد', '1404-3-16': 'عید سعید قربان', '1404-3-24': 'عید سعید غدیر خم',
        '1404-4-14': 'تاسوعای حسینی', '1404-4-15': 'عاشورای حسینی',
        '1404-5-23': 'اربعین حسینی', '1404-5-31': 'رحلت حضرت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)',
        '1404-6-2': 'شهادت امام رضا (ع)', '1404-6-10': 'شهادت امام حسن عسکری (ع)', '1404-6-19': 'میلاد رسول اکرم (ص) و امام جعفر صادق (ع)',
        '1404-9-3': 'شهادت حضرت فاطمه (س)',
        '1404-10-13': 'ولادت حضرت امام علی (ع) و روز پدر', '1404-10-27': 'مبعث حضرت رسول اکرم (ص)',
        '1404-11-15': 'ولادت حضرت قائم (عج) و جشن نیمه شعبان', '1404-11-22': 'پیروزی انقلاب اسلامی ایران',
        '1404-12-20': 'شهادت حضرت علی (ع)', '1404-12-29': 'روز ملی شدن صنعت نفت ایران',
        // 1405
        '1405-1-1': 'عید نوروز و عید سعید فطر', '1405-1-2': 'عید نوروز و تعطیل به مناسبت عید فطر', '1405-1-3': 'عید نوروز', '1405-1-4': 'عید نوروز', '1405-1-12': 'روز جمهوری اسلامی ایران', '1405-1-13': 'روز طبیعت', '1405-1-25': 'شهادت امام جعفر صادق (ع)',
        '1405-3-6': 'عید سعید قربان', '1405-3-14': 'عید غدیر خم و رحلت حضرت امام خمینی (ره)', '1405-3-15': 'قیام ۱۵ خرداد',
        '1405-4-3': 'تاسوعای حسینی', '1405-4-4': 'عاشورای حسینی',
        '1405-5-13': 'اربعین حسینی', '1405-5-21': 'رحلت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)', '1405-5-22': 'شهادت امام رضا (ع)', '1405-5-30': 'شهادت امام حسن عسکری (ع)',
        '1405-6-8': 'میلاد رسول اکرم (ص) و امام جعفر صادق (ع)',
        '1405-8-22': 'شهادت حضرت زهرا (س)',
        '1405-10-2': 'ولادت امام علی (ع) و روز پدر', '1405-10-16': 'مبعث حضرت رسول اکرم (ص)',
        '1405-11-4': 'ولادت حضرت قائم (عج) و جشن نیمه شعبان', '1405-11-22': 'پیروزی انقلاب اسلامی',
        '1405-12-9': 'شهادت حضرت علی (ع)', '1405-12-19': 'عید سعید فطر', '1405-12-20': 'تعطیل به مناسبت عید فطر',
        // 1406
        '1406-1-1': 'عید نوروز', '1406-1-2': 'عید نوروز', '1406-1-3': 'عید نوروز', '1406-1-4': 'عید نوروز', '1406-1-12': 'روز جمهوری اسلامی ایران', '1406-1-13': 'روز طبیعت', '1406-1-14': 'شهادت امام جعفر صادق (ع)',
        '1406-3-4': 'عید سعید غدیر خم', '1406-3-14': 'رحلت حضرت امام خمینی (ره)', '1406-3-15': 'قیام خونین ۱۵ خرداد', '1406-3-25': 'تاسوعای حسینی', '1406-3-26': 'عاشورای حسینی',
        '1406-11-22': 'پیروزی انقلاب اسلامی', '1406-11-29': 'شهادت حضرت علی (ع)',
        '1406-12-8': 'عید سعید فطر', '1406-12-9': 'تعطیل به مناسبت عید فطر', '1406-12-29': 'روز ملی شدن صنعت نفت ایران',
        // 1407
        '1407-1-1': 'عید نوروز', '1407-1-2': 'عید نوروز', '1407-1-3': 'عید نوروز', '1407-1-4': 'عید نوروز', '1407-1-12': 'روز جمهوری اسلامی ایران', '1407-1-13': 'روز طبیعت',
        '1407-3-14': 'رحلت حضرت امام خمینی (ره)', '1407-3-15': 'قیام خونین ۱۵ خرداد',
        '1407-11-22': 'پیروزی انقلاب اسلامی',
        '1407-12-29': 'روز ملی شدن صنعت نفت ایران'
    };

    // ========== PERSIAN NUMERALS & NEW FORMAT FUNCTIONS (v11.4.0) ==========

    // Convert English numerals to Persian numerals
    var PERSIAN_NUMERALS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    function toPersianNumerals(str) {
        if (!str) return str;
        return String(str).replace(/[0-9]/g, function (d) {
            return PERSIAN_NUMERALS[parseInt(d, 10)];
        });
    }

    // Format Persian date as YYYY/MM/DD (exactly 10 characters)
    function formatPersianDateSlash(jy, jm, jd) {
        var year = String(jy);
        var month = jm < 10 ? '0' + jm : String(jm);
        var day = jd < 10 ? '0' + jd : String(jd);
        return year + '/' + month + '/' + day;
    }

    // Format Persian DateTime as YYYY/MM/DD HH:MM (24-hour format)
    function formatPersianDateTime24(jy, jm, jd, hour24, minute) {
        var dateStr = formatPersianDateSlash(jy, jm, jd);
        var hourStr = hour24 < 10 ? '0' + hour24 : String(hour24);
        var minStr = minute < 10 ? '0' + minute : String(minute);
        return dateStr + ' ' + hourStr + ':' + minStr;
    }

    // Persian relative time translations
    var PERSIAN_RELATIVE_TIME = {
        'just now': 'همین الان',
        'a moment ago': 'لحظاتی قبل',
        'a few seconds ago': 'چند ثانیه قبل',
        'seconds ago': 'ثانیه قبل',
        'a minute ago': 'یک دقیقه قبل',
        'minutes ago': 'دقیقه قبل',
        'an hour ago': 'یک ساعت قبل',
        'hours ago': 'ساعت قبل',
        'a day ago': 'یک روز قبل',
        'days ago': 'روز قبل',
        'yesterday': 'دیروز',
        'a week ago': 'یک هفته قبل',
        'weeks ago': 'هفته قبل',
        'a month ago': 'یک ماه قبل',
        'months ago': 'ماه قبل',
        'a year ago': 'یک سال قبل',
        'years ago': 'سال قبل',
        'today': 'امروز',
        'tomorrow': 'فردا',
        'in a moment': 'در لحظاتی دیگر',
        'in': 'در',
        'ago': 'قبل'
    };

    // Parse compound durations (e.g., "1 days 4 hours 10 minutes" or "1d 4h 10m")
    function parseCompoundDuration(str) {
        if (!str) return null;
        var original = str.trim().toLowerCase();
        
        // Remove standard joining words like "and" or commas
        var cleaned = original.replace(/\band\b/g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Match patterns like "(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?|s|m|h|d|w|y)\b"
        var segmentRegex = /(\d+)\s*(second|minute|hour|day|week|month|year|s|m|h|d|w|y)s?\b/g;
        var matches = [];
        var match;
        var lastIndex = 0;
        
        while ((match = segmentRegex.exec(cleaned)) !== null) {
            // Check if there's any unparsed text between matches (excluding whitespace)
            var between = cleaned.substring(lastIndex, match.index).trim();
            if (between.length > 0) {
                return null;
            }
            matches.push({
                num: match[1],
                unit: match[2]
            });
            lastIndex = segmentRegex.lastIndex;
        }
        
        // If the whole string wasn't consumed (excluding trailing whitespace)
        if (lastIndex < cleaned.length && cleaned.substring(lastIndex).trim().length > 0) {
            return null;
        }
        
        if (matches.length === 0) {
            return null;
        }
        
        var unitMap = {
            'second': 'ثانیه', 's': 'ثانیه',
            'minute': 'دقیقه', 'm': 'دقیقه',
            'hour': 'ساعت', 'h': 'ساعت',
            'day': 'روز', 'd': 'روز',
            'week': 'هفته', 'w': 'هفته',
            'month': 'ماه',
            'year': 'سال', 'y': 'سال'
        };
        
        var parts = [];
        for (var i = 0; i < matches.length; i++) {
            var num = matches[i].num;
            var unit = matches[i].unit;
            var translatedUnit = unitMap[unit] || unit;
            parts.push(toPersianNumerals(num) + ' ' + translatedUnit);
        }
        
        return parts.join(' و ');
    }

    // Recursive text node walker to process all text content including siblings
    function walkTextNodes(element, callback) {
        var node = element.firstChild;
        while (node) {
            if (node.nodeType === 3) { // Text node
                callback(node);
            } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE' && node.nodeName !== 'TEXTAREA') {
                walkTextNodes(node, callback);
            }
            node = node.nextSibling;
        }
    }

    // Broad string translator for relative times, bracketed seconds, and durations
    function translateTextInString(text) {
        if (!text) return text;
        
        // Skip if already containing Persian numerals or key Persian relative words to avoid double translation
        if (text.match(/[۰-۹]/) || text.match(/قبل|الان|دیروز|امروز|فردا|ساعت/)) {
            return text;
        }
        
        var original = text;
        
        // 1. Yesterday/Today/Tomorrow at/or time (e.g. "Yesterday at 1:06 PM" or "Yesterday 1:06 PM")
        var yesterdayTodayRegex = /\b(yesterday|today|tomorrow)\s+(?:at\s+)?(\d{1,2}):(\d{2})(?:\s*(am|pm))?\b/gi;
        original = original.replace(yesterdayTodayRegex, function (match, dayWord, hour, minute, ampm) {
            var h = parseInt(hour, 10);
            if (ampm) {
                var ampmLower = ampm.toLowerCase();
                if (ampmLower === 'pm' && h !== 12) {
                    h += 12;
                } else if (ampmLower === 'am' && h === 12) {
                    h = 0;
                }
            }
            var hStr = (h < 10 ? '0' : '') + h;
            var dayTranslate = {
                'yesterday': 'دیروز',
                'today': 'امروز',
                'tomorrow': 'فردا'
            };
            var translatedDay = dayTranslate[dayWord.toLowerCase()] || dayWord;
            return translatedDay + ' ساعت ' + toPersianNumerals(hStr) + ':' + toPersianNumerals(minute);
        });
        
        // 2. Duration with bracketed seconds (e.g. "30 minutes [ 1800 ]" or "1 hour 12 minutes [ 4320 ]")
        var bracketedDurationRegex = /\b((?:\b\d+\s+(?:second|minute|hour|day|week|month|year|s|m|h|d|w|y)s?\s*(?:and\s*)?)+)\s*\[\s*(\d+)\s*\]/gi;
        original = original.replace(bracketedDurationRegex, function (match, durationStr, rawSeconds) {
            var parsedDuration = parseCompoundDuration(durationStr);
            if (parsedDuration) {
                var persianSeconds = toPersianNumerals(rawSeconds);
                return parsedDuration + ' [ ' + persianSeconds + ' ]';
            }
            return match;
        });

        // 3. Bracketed simple numbers (e.g. "[ 1800 ]")
        var bracketedNumbersRegex = /\b(\d+)\s*\[\s*(\d+)\s*\]/g;
        original = original.replace(bracketedNumbersRegex, function (match, num1, num2) {
            return toPersianNumerals(num1) + ' [ ' + toPersianNumerals(num2) + ' ]';
        });

        // 4. Compound / Simple Relative Times: "X days Y hours ago"
        var relativeTimeRegex = /\b((?:\b\d+\s+(?:second|minute|hour|day|week|month|year|s|m|h|d|w|y)s?\s*(?:and\s*)?)+)ago\b/gi;
        original = original.replace(relativeTimeRegex, function (match, durationPart) {
            var compoundParsed = parseCompoundDuration(durationPart);
            if (compoundParsed) {
                return compoundParsed + ' قبل';
            }
            return match;
        });
        
        // 5. Future relative times: "in X minutes"
        var futureRelativeRegex = /\bin\s+((?:\b\d+\s+(?:second|minute|hour|day|week|month|year|s|m|h|d|w|y)s?\s*(?:and\s*)?)+)/gi;
        original = original.replace(futureRelativeRegex, function (match, durationPart) {
            var compoundParsed = parseCompoundDuration(durationPart);
            if (compoundParsed) {
                return 'در ' + compoundParsed;
            }
            return match;
        });

        // 6. Simple Relative Times without numbers: "yesterday", "today", "just now", etc.
        var simpleRelativeRegex = /\b(just now|a moment ago|a few seconds ago|seconds ago|a minute ago|minutes ago|an hour ago|hours ago|a day ago|days ago|yesterday|a week ago|weeks ago|a month ago|months ago|a year ago|years ago|today|tomorrow)\b/gi;
        original = original.replace(simpleRelativeRegex, function (match) {
            var lower = match.toLowerCase();
            return PERSIAN_RELATIVE_TIME[lower] || match;
        });

        // 7. Single or Compound Durations: "12 minutes" or "2 hours" (not followed by "ago" or inside brackets)
        var durationRegex = /\b((?:\b\d+\s+(?:second|minute|hour|day|week|month|year|s|m|h|d|w|y)s?\s*(?:and\s*)?)+)\b/gi;
        original = original.replace(durationRegex, function (match) {
            if (match.trim().match(/^\d+$/)) {
                return match;
            }
            var compoundParsed = parseCompoundDuration(match);
            if (compoundParsed) {
                return compoundParsed;
            }
            return match;
        });

        return original;
    }

    // Convert relative time text to Persian (e.g., "15 minutes ago" -> "۱۵ دقیقه قبل")
    function convertRelativeTimeToPersian(text) {
        if (!text) return text;
        var original = text.trim().toLowerCase();

        // Direct translations
        if (PERSIAN_RELATIVE_TIME[original]) {
            return PERSIAN_RELATIVE_TIME[original];
        }

        // Pattern: "Yesterday/Today at X:XX AM/PM" or "Yesterday/Today X:XX AM/PM"
        var yesterdayTodayMatch = original.match(/^(yesterday|today|tomorrow)\s+(?:at\s+)?(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
        if (yesterdayTodayMatch) {
            var dayWord = yesterdayTodayMatch[1].toLowerCase();
            var hour = parseInt(yesterdayTodayMatch[2], 10);
            var minute = yesterdayTodayMatch[3];
            var ampm = yesterdayTodayMatch[4];

            if (ampm) {
                ampm = ampm.toUpperCase();
                if (ampm === 'PM' && hour !== 12) {
                    hour += 12;
                } else if (ampm === 'AM' && hour === 12) {
                    hour = 0;
                }
            }

            var hourStr = (hour < 10 ? '0' : '') + hour;
            var persianTimeStr = toPersianNumerals(hourStr) + ':' + toPersianNumerals(minute);
            var dayTranslate = {
                'yesterday': 'دیروز',
                'today': 'امروز',
                'tomorrow': 'فردا'
            };
            return dayTranslate[dayWord] + ' ساعت ' + persianTimeStr;
        }

        // Support compound relative times: "X days Y hours Z minutes ago"
        if (original.indexOf(' ago') > -1) {
            var idx = original.lastIndexOf(' ago');
            var durationPart = original.substring(0, idx).trim();
            var compoundParsed = parseCompoundDuration(durationPart);
            if (compoundParsed) {
                return compoundParsed + ' قبل';
            }
        }
        
        if (original.indexOf('in ') === 0) {
            var durationPart = original.substring(3).trim();
            var compoundParsed = parseCompoundDuration(durationPart);
            if (compoundParsed) {
                return 'در ' + compoundParsed;
            }
        }

        // Pattern: "X unit ago" (e.g., "15 minutes ago", "2 hours ago")
        var match = original.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i);
        if (match) {
            var num = match[1];
            var unit = match[2].toLowerCase();
            var persianNum = toPersianNumerals(num);
            var persianUnits = {
                'second': 'ثانیه',
                'minute': 'دقیقه',
                'hour': 'ساعت',
                'day': 'روز',
                'week': 'هفته',
                'month': 'ماه',
                'year': 'سال'
            };
            return persianNum + ' ' + persianUnits[unit] + ' قبل';
        }

        // Pattern: "in X unit" (e.g., "in 5 minutes")
        var futureMatch = original.match(/^in\s+(\d+)\s+(second|minute|hour|day|week|month|year)s?$/i);
        if (futureMatch) {
            var num = futureMatch[1];
            var unit = futureMatch[2].toLowerCase();
            var persianNum = toPersianNumerals(num);
            var persianUnits = {
                'second': 'ثانیه',
                'minute': 'دقیقه',
                'hour': 'ساعت',
                'day': 'روز',
                'week': 'هفته',
                'month': 'ماه',
                'year': 'سال'
            };
            return 'در ' + persianNum + ' ' + persianUnits[unit];
        }

        return null; // Could not convert
    }

    // Convert duration text to Persian (e.g., "15 minutes" -> "۱۵ دقیقه", "2 hours" -> "۲ ساعت", "15m", "1h 30m")
    function convertDurationToPersian(text) {
        if (!text) return text;
        
        var originalText = text.trim();
        var prefix = '';
        var prefixMatch = originalText.match(/^(Original|New|Old Value|New Value):\s*/i);
        var restOfText = originalText;
        if (prefixMatch) {
            prefix = prefixMatch[0];
            restOfText = originalText.substring(prefix.length).trim();
        }
        var original = restOfText.toLowerCase();

        // Pattern: Duration with bracketed seconds (e.g. "30 minutes [ 1800 ]", "1 hour 12 minutes [ 4320 ]")
        var bracketedDurationMatch = original.match(/^([\d\s\w,]+?)\s*\[\s*(\d+)\s*\]$/i);
        if (bracketedDurationMatch) {
            var durationStr = bracketedDurationMatch[1].trim();
            var rawSeconds = bracketedDurationMatch[2].trim();
            
            var parsedDuration = parseCompoundDuration(durationStr);
            if (parsedDuration) {
                var persianSeconds = toPersianNumerals(rawSeconds);
                return prefix + parsedDuration + ' [ ' + persianSeconds + ' ]';
            }
        }

        // Pattern: Just bracketed numbers (e.g. "10201 [ 10201 ]")
        var bracketedNumbersMatch = original.match(/^(\d+)\s*\[\s*(\d+)\s*\]$/);
        if (bracketedNumbersMatch) {
            var num1 = bracketedNumbersMatch[1];
            var num2 = bracketedNumbersMatch[2];
            return prefix + toPersianNumerals(num1) + ' [ ' + toPersianNumerals(num2) + ' ]';
        }

        // Try compound duration
        var compoundParsed = parseCompoundDuration(original);
        if (compoundParsed) {
            return prefix + compoundParsed;
        }

        // Fallbacks:
        // Pattern: "X unit" or "Xu" (e.g., "15 minutes", "15m", "2 hours", "2h")
        var singleUnitMatch = original.match(/^(\d+)\s*(second|minute|hour|day|week|month|year|s|m|h|d|w|y)s?$/i);
        if (singleUnitMatch) {
            var num = singleUnitMatch[1];
            var unit = singleUnitMatch[2].toLowerCase();
            var persianNum = toPersianNumerals(num);

            var unitMap = {
                's': 'second', 'sec': 'second',
                'm': 'minute', 'min': 'minute',
                'h': 'hour',
                'd': 'day',
                'w': 'week',
                'y': 'year'
            };

            var normalizedUnit = unitMap[unit] || unit;

            var persianUnits = {
                'second': 'ثانیه',
                'minute': 'دقیقه',
                'hour': 'ساعت',
                'day': 'روز',
                'week': 'هفته',
                'month': 'ماه',
                'year': 'سال'
            };
            return prefix + persianNum + ' ' + (persianUnits[normalizedUnit] || normalizedUnit);
        }

        // Pattern: "Xh Ym" or "X hours Y minutes"
        var hoursMinutesMatch = original.match(/(\d+)\s*(?:h|hours?)\s*(\d+)\s*(?:m|minutes?)/i);
        if (hoursMinutesMatch) {
            var hours = hoursMinutesMatch[1];
            var mins = hoursMinutesMatch[2];
            return prefix + toPersianNumerals(hours) + ' ساعت ' + toPersianNumerals(mins) + ' دقیقه';
        }

        // Pattern: "Xd Yh" (Days and Hours)
        var daysHoursMatch = original.match(/(\d+)\s*(?:d|days?)\s*(\d+)\s*(?:h|hours?)/i);
        if (daysHoursMatch) {
            var days = daysHoursMatch[1];
            var hours = daysHoursMatch[2];
            return prefix + toPersianNumerals(days) + ' روز ' + toPersianNumerals(hours) + ' ساعت';
        }

        return null;
    }

    // Convert absolute Gregorian date string to Persian (e.g. "13/May/26 8:53 PM" -> "23 اردیبهشت 1405 20:53", "May 13" -> "23 اردیبهشت")
    function convertAbsoluteDateTextToPersian(fullText) {
        if (!fullText) return null;
        
        var prefix = '';
        var textToParse = fullText.trim();
        var prefixMatch = textToParse.match(/^(Original|New|Old Value|New Value):\s*/i);
        if (prefixMatch) {
            prefix = prefixMatch[0];
            textToParse = textToParse.substring(prefix.length).trim();
        }

        // Support Month-Day and Month-Day-Year textual dates (e.g. "May 13", "13 May", "May 13, 2026", "13 May 2026")
        var monthNamesAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        var monthNamesFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        var monthRegexStr = '(' + monthNamesAbbr.concat(monthNamesFull).join('|') + ')';

        // Pattern A: "Month Day, Year" or "Month Day Year" e.g., "May 13, 2026" or "May 13 2026"
        var monthDayYearMatch = textToParse.match(new RegExp('^' + monthRegexStr + '\\s+(\\d{1,2})(?:,\\s*|\\s+)(\\d{4})$', 'i'));
        // Pattern B: "Day Month Year" e.g., "13 May 2026"
        var dayMonthYearMatch = textToParse.match(new RegExp('^(\\d{1,2})\\s+' + monthRegexStr + '\\s+(\\d{4})$', 'i'));
        // Pattern C: "Month Day" e.g., "May 13"
        var monthDayMatch = textToParse.match(new RegExp('^' + monthRegexStr + '\\s+(\\d{1,2})$', 'i'));
        // Pattern D: "Day Month" e.g., "13 May"
        var dayMonthMatch = textToParse.match(new RegExp('^(\\d{1,2})\\s+' + monthRegexStr + '$', 'i'));

        var monthStr = '';
        var dayVal = 0;
        var yearVal = 0;
        var hasYear = false;

        if (monthDayYearMatch) {
            monthStr = monthDayYearMatch[1].toLowerCase();
            dayVal = parseInt(monthDayYearMatch[2], 10);
            yearVal = parseInt(monthDayYearMatch[3], 10);
            hasYear = true;
        } else if (dayMonthYearMatch) {
            monthStr = dayMonthYearMatch[2].toLowerCase();
            dayVal = parseInt(dayMonthYearMatch[1], 10);
            yearVal = parseInt(dayMonthYearMatch[3], 10);
            hasYear = true;
        } else if (monthDayMatch) {
            monthStr = monthDayMatch[1].toLowerCase();
            dayVal = parseInt(monthDayMatch[2], 10);
            yearVal = new Date().getFullYear();
            hasYear = false;
        } else if (dayMonthMatch) {
            monthStr = dayMonthMatch[2].toLowerCase();
            dayVal = parseInt(dayMonthMatch[1], 10);
            yearVal = new Date().getFullYear();
            hasYear = false;
        }

        if (monthStr && dayVal > 0) {
            var gMonth = 0;
            var abbrIdx = monthNamesAbbr.indexOf(monthStr);
            if (abbrIdx !== -1) {
                gMonth = abbrIdx + 1;
            } else {
                var fullIdx = monthNamesFull.indexOf(monthStr);
                if (fullIdx !== -1) {
                    gMonth = fullIdx + 1;
                }
            }

            if (gMonth > 0) {
                var jDate = toJalaali(yearVal, gMonth, dayVal);
                var displayText = '';
                if (hasYear) {
                    displayText = formatPersianDate(jDate.jy, jDate.jm, jDate.jd);
                } else {
                    displayText = jDate.jd + ' ' + PERSIAN_MONTHS[jDate.jm - 1];
                }

                var rlm = '\u200F';  // Right-to-Left Mark
                if (prefix) {
                    displayText = prefix + rlm + ' ' + displayText;
                }
                return displayText;
            }
        }

        // Extract date part first (before any time)
        var datePart = textToParse.split(/\s+\d{1,2}:/)[0].trim();
        var timePart = '';

        // Match time with AM/PM format (e.g., "7:11 PM" or "12:30 AM")
        var timeMatch = textToParse.match(/\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
            var hour = parseInt(timeMatch[1], 10);
            var minute = timeMatch[2];
            var ampm = timeMatch[3].toUpperCase();

            // Convert to 24-hour format
            if (ampm === 'PM' && hour !== 12) {
                hour += 12;
            } else if (ampm === 'AM' && hour === 12) {
                hour = 0;
            }

            // Format with leading zero
            var hour24 = (hour < 10 ? '0' : '') + hour;
            timePart = ' ' + hour24 + ':' + minute;
        } else {
            // Try to match time without AM/PM (already 24-hour format)
            var time24Match = textToParse.match(/\s+(\d{1,2}:\d{2})(?!\s*[AP]M)/i);
            if (time24Match) {
                timePart = ' ' + time24Match[1];
            }
        }

        var parsed = parseJiraDate(datePart);
        if (parsed) {
            var jDate = toJalaali(parsed.year, parsed.month, parsed.day);
            var persianDateStr = formatPersianDate(jDate.jy, jDate.jm, jDate.jd);
            
            // The LRM (Left-to-Right Mark) character helps separate the time from Persian text
            var lrm = '\u200E';  // Left-to-Right Mark
            var rlm = '\u200F';  // Right-to-Left Mark

            var displayText = persianDateStr;
            if (timePart) {
                displayText = displayText + lrm + timePart;
            }

            // Prepend original prefix if it existed
            if (prefix) {
                displayText = prefix + rlm + ' ' + displayText;
            }

            return displayText;
        }
        return null;
    }

    function convertSameOriginIframe(iframe) {
        try {
            var iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (!iframeDoc || !iframeDoc.body) {
                return;
            }

            // Skip if already processed
            if (iframe._pcProcessed) {
                return;
            }
            iframe._pcProcessed = true;

            logInfo('Converting same-origin iframe content');

            // 1. Initial conversion
            performIframeConversion(iframeDoc);

            // 2. Attach MutationObserver
            var observer = new MutationObserver(function (mutations) {
                var hasNewContent = false;
                mutations.forEach(function (mutation) {
                    if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
                        hasNewContent = true;
                    }
                });

                if (hasNewContent) {
                    clearTimeout(iframe._pcConvertTimeout);
                    iframe._pcConvertTimeout = setTimeout(function () {
                        performIframeConversion(iframeDoc);
                    }, 200);
                }
            });

            observer.observe(iframeDoc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });

            logInfo('Attached MutationObserver to same-origin iframe');

        } catch (e) {
            logDebug('Cannot access iframe content (cross-origin?): ' + e.message);
        }
    }

    function performIframeConversion(iframeDoc) {
        if (!iframeDoc || !iframeDoc.body) return;

        // Convert raw text nodes
        walkTextNodes(iframeDoc.body, function (node) {
            var text = node.nodeValue;
            if (!text) return;

            // Skip empty or already translated to Persian
            if (text.match(/[۰-۹]/) || text.match(/قبل|الان|دیروز|امروز|فردا/)) {
                return;
            }

            var newText = translateTextInString(text);
            if (newText !== text) {
                node.nodeValue = newText;
            }
        });

        // Translate specific elements (like <time> or .livestamp or elements inside Activity Stream) using jQuery (if jQuery is available in context)
        if (typeof jQuery !== 'undefined') {
            var $ = jQuery;
            var timestampSelectors = [
                'time',
                '.livestamp',
                '[data-livestamp]',
                '.date',
                '.timestamp',
                'h2.date-header',
                '.date-header'
            ];
            $(timestampSelectors.join(','), iframeDoc).each(function () {
                var $el = $(this);
                var text = $el.text().trim();

                // Skip if empty or already Persian
                if (!text || text.match(/[۰-۹]/) || text.match(/قبل|الان|دیروز|فردا/)) {
                    return;
                }

                var persianTime = convertRelativeTimeToPersian(text);
                if (!persianTime) {
                    persianTime = convertAbsoluteDateTextToPersian(text);
                }
                if (persianTime) {
                    $el.attr('title', text); // Keep original as tooltip
                    $el.text(persianTime);
                    $el.css({
                        'direction': 'rtl',
                        'unicode-bidi': 'embed'
                    });
                }
            });
        }
    }

    function scanAndProcessAllSameOriginIframes() {
        var iframes = document.querySelectorAll('iframe');
        iframes.forEach(function (iframe) {
            try {
                // If the iframe already has body content, process it
                var iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                if (iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML) {
                    convertSameOriginIframe(iframe);
                }
                
                // Also always attach a load listener in case it reloads or is still loading
                if (!iframe._pcLoadListenerAttached) {
                    iframe._pcLoadListenerAttached = true;
                    iframe.addEventListener('load', function () {
                        logDebug('Same-origin iframe loaded, converting...');
                        // Short delay to let dynamic JS (like Activity Stream widgets) render their initial content
                        setTimeout(function () {
                            convertSameOriginIframe(iframe);
                        }, 500);
                    });
                }
            } catch (e) {
                // Cross-origin iframe, ignore
            }
        });
    }

    // Convert Activity Stream timestamps to Persian
    function convertActivityStreamTime($) {
        logInfo('=== Converting Activity Stream Timestamps ===');

        var timestampSelectors = [
            '.livestamp',
            'time.livestamp',
            'span.livestamp',
            '[data-livestamp]',
            '.activity-stream time',
            '.activity-stream .livestamp',
            '.activity-item time',
            '.activity-item .date',
            '#activity-stream time',
            '#activity-stream .livestamp',
            '.activity-stream-container time',
            '.activity-stream-container .livestamp',
            // Dashboard Activity Stream
            '.activity-stream-issue-item time',
            '.activity-stream-issue-item .date',
            '.gadget-activity-stream time',
            '.gadget-activity-stream .livestamp',
            // Issue Detail Page Activity (v11.4.0)
            '#activitymodule .activity-item time',
            '#activitymodule time.livestamp',
            '#activitymodule .livestamp',
            '#activitymodule time',
            '.issue-activity-stream time',
            '.issue-activity-stream .livestamp',
            '#issue-tabs-container time',
            '#issue-tabs-container .livestamp',
            // Activity tab
            '#activity-stream-issue-tab time',
            '#activity-stream-issue-tab .livestamp',
            // Work log timestamps
            '#worklog-tabpanel time',
            '#worklog-tabpanel .livestamp',
            '.worklog-container time',
            '.worklog-container .livestamp',
            // Change history
            '#changehistory-tabpanel time',
            '#changehistory-tabpanel .livestamp',
            // Comments
            '#comment-tabpanel time',
            '#comment-tabpanel .livestamp',
            // Action containers
            '.actionContainer time',
            '.actionContainer .livestamp',
            '.actionContainer .date',
            '.action-details time',
            '.action-details .livestamp',
            // Issue body activity
            '.issue-body-content time',
            '.issue-data-block time',
            '.changehistorydetails time',
            // All time elements with datetime attribute
            'time[datetime]',
            // Date headers in Activity Stream
            'h2.date-header',
            '.date-header'
        ];

        var convertedCount = 0;

        $(timestampSelectors.join(',')).each(function () {
            var $el = $(this);
            var text = $el.text().trim();

            // Skip if empty or already Persian
            if (!text || text.match(/[۰-۹]/) || text.match(/قبل|الان|دیروز|فردا/)) {
                return;
            }

            var persianTime = convertRelativeTimeToPersian(text);
            if (!persianTime) {
                persianTime = convertAbsoluteDateTextToPersian(text);
            }

            if (persianTime) {
                $el.attr('title', text); // Keep original as tooltip
                $el.text(persianTime);
                $el.data('pc-time-converted', true);
                $el.css({
                    'direction': 'rtl',
                    'unicode-bidi': 'embed'
                });
                logInfo('Converted time: ' + text + ' → ' + persianTime);
                convertedCount++;
            }
        });

        logInfo('Activity Stream times converted: ' + convertedCount);

        // Also do aggressive text-based conversion for any missed elements
        convertAllRelativeTimesInPage($);

        // Scan and convert same-origin iframes (like Activity Stream gadget)
        scanAndProcessAllSameOriginIframes();
    }

    // Aggressive text-based conversion - find ALL elements with relative time text
    function convertAllRelativeTimesInPage($) {
        logInfo('=== Aggressive Text-Based Relative Time Conversion ===');

        var convertedCount = 0;

        // Search through all text nodes in Activity-related containers
        var containers = [
            '#activitymodule',
            '.activity-stream',
            '#activity-stream-issue-tab',
            '#activity-tabpanel',
            '.activity-item',
            '.activity-item-summary',
            '.activity-item-description',
            '#worklog-tabpanel',
            '#changehistory-tabpanel',
            '#comment-tabpanel',
            '.actionContainer',
            '.issue-data-block',
            '.issue-body-content'
        ];

        $(containers.join(',')).each(function () {
            walkTextNodes(this, function (node) {
                var text = node.nodeValue;
                if (!text) return;

                // Skip empty or already translated to Persian
                if (text.match(/[۰-۹]/) || text.match(/قبل|الان|دیروز|امروز|فردا/)) {
                    return;
                }

                var newText = translateTextInString(text);
                if (newText !== text) {
                    node.nodeValue = newText;
                    convertedCount++;
                }
            });
        });

        logInfo('Text-based conversion completed: ' + convertedCount);
    }

    // Setup observer specifically for livestamp elements that update dynamically
    function setupLivestampObserver($) {
        if (window.pcLivestampObserver) return; // Already setup

        logInfo('Setting up Livestamp Observer for dynamic updates');

        window.pcLivestampObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    var target = mutation.target;
                    var $target = $(target);

                    // For characterData, target is the text node, get parent element
                    if (mutation.type === 'characterData') {
                        $target = $(target.parentNode);
                    }

                    // Check if this is a time/livestamp element
                    if ($target.is('time, .livestamp, [data-livestamp]') ||
                        $target.closest('time, .livestamp').length > 0) {

                        var text = $target.text().trim();

                        // Skip if already Persian
                        if (text.match(/[۰-۹]/) || text.match(/قبل|الان|دیروز/)) {
                            return;
                        }

                        var persianTime = convertRelativeTimeToPersian(text);
                        if (!persianTime) {
                            persianTime = convertAbsoluteDateTextToPersian(text);
                        }

                        if (persianTime) {
                            $target.text(persianTime);
                            $target.css({
                                'direction': 'rtl',
                                'unicode-bidi': 'embed'
                            });
                            logDebug('Livestamp observer converted: ' + text + ' → ' + persianTime);
                        }
                    }
                }
            });
        });

        // Observe the entire document for livestamp updates
        window.pcLivestampObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        logInfo('Livestamp Observer attached');
    }

    // Convert Time Spent / Duration fields to Persian (e.g., "15 minutes" -> "۱۵ دقیقه")
    function convertTimeSpentDurations($) {
        logInfo('=== Converting Time Spent / Durations ===');

        var durationSelectors = [
            // Time Spent in Issue tables
            '.issue-table td.timespent',
            '.issue-table td[data-field-id="timespent"]',
            'td.timespent',
            'td[data-field-id="timespent"]',
            // Time Spent in Issue Detail
            '#timespent-val',
            '#timeestimate-val',
            '#aggregatetimespent-val',
            '#aggregatetimeestimate-val',
            // Work log durations
            '.worklog-duration',
            '.worklog-time-spent',
            '#worklog-tabpanel .duration',
            // Time tracking module
            '#tt_single_values_orig .tt_inner',
            '#tt_single_values_remain .tt_inner',
            '#tt_single_values_spent .tt_inner',
            '.tt_graph_numbers',
            // Generic patterns
            '[id*="timespent"]',
            '[id*="timeestimate"]',
            '.time-spent',
            '.time-logged',
            // Activity Work Log entries
            '.worklog-entry .duration',
            '.worklog-entry .tt',
            '.actionContainer .worklog-duration',
            // dd elements (definition descriptions often used for values)
            'dd#timespent-val',
            'dd#timeestimate-val',
            // History Tab (Original/New values)
            'td.activity-old-val',
            'td.activity-new-val',
            '.activity-old-val',
            '.activity-new-val'
        ];

        var convertedCount = 0;

        $(durationSelectors.join(',')).each(function () {
            var $el = $(this);

            // Skip already converted
            if ($el.data('pc-duration-converted')) {
                return;
            }

            var text = $el.text().trim();

            // Skip empty or already Persian
            if (!text || text.match(/[۰-۹]/)) {
                return;
            }

            var persianDuration = convertDurationToPersian(text);

            if (persianDuration) {
                $el.attr('title', text);
                $el.text(persianDuration);
                $el.data('pc-duration-converted', true);
                $el.css('direction', 'rtl');
                logInfo('Converted duration: ' + text + ' → ' + persianDuration);
                convertedCount++;
            }
        });

        // Also scan all text nodes inside activity and comment containers for embedded English durations (e.g. "logged '12 minutes'")
        var textContainers = [
            '#activitymodule',
            '.activity-stream',
            '#activity-stream-issue-tab',
            '#activity-tabpanel',
            '.activity-item',
            '.activity-item-summary',
            '.activity-item-description',
            '#worklog-tabpanel',
            '#changehistory-tabpanel',
            '#comment-tabpanel',
            '.actionContainer',
            '.issue-data-block',
            '.issue-body-content'
        ];

        function replaceDurationsInString(str) {
            if (!str) return str;
            
            var persianUnits = {
                'second': 'ثانیه',
                'minute': 'دقیقه',
                'hour': 'ساعت',
                'day': 'روز',
                'week': 'هفته',
                'month': 'ماه',
                'year': 'سال'
            };

            return str.replace(/\b(\d+)\s*(second|minute|hour|day|week|month|year)s?\b(?!\s+ago)/gi, function(match, num, unit) {
                var persianNum = toPersianNumerals(num);
                var normalizedUnit = unit.toLowerCase();
                var translatedUnit = persianUnits[normalizedUnit] || normalizedUnit;
                return persianNum + ' ' + translatedUnit;
            });
        }

        $(textContainers.join(',')).each(function() {
            $(this).find('*').contents().each(function() {
                if (this.nodeType === 3) { // Text node
                    var text = this.nodeValue;
                    if (text && text.match(/\b\d+\s*(second|minute|hour|day|week|month|year)s?\b(?!\s+ago)/i)) {
                        // Skip if already has Persian numerals to avoid double conversion
                        if (text.match(/[۰-۹]/)) {
                            return;
                        }
                        var newText = replaceDurationsInString(text);
                        if (newText !== text) {
                            this.nodeValue = newText;
                            convertedCount++;
                        }
                    }
                }
            });
        });

        logInfo('Time Spent / Durations converted: ' + convertedCount);
    }

    // Convert Advanced Audit Log and System Info dates to Persian format
    function convertAuditLogDates($) {
        var auditDateRegex = /([a-z]+)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+(GMT[+-]\d{1,2}:\d{2})/i;
        var isoDateRegex = /(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/i;
        var sysDateRegex1 = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})/i;
        var sysDateRegex2 = /(\d{1,2})\/([a-z]+)\/(\d{2})(?:\s+(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?))?/i;
        var sysDateRegex3 = /(?:mon|tue|wed|thu|fri|sat|sun)\s+([a-z]+)\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+[A-Z]+\s+(\d{4})/i;
        var sysDateRegex4 = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i;
        var sysDateRegex5 = /([a-z]{3,})\s+(\d{1,2}),\s+(\d{4})/i;
        var sysDateRegex6 = /(\d{1,2})\/([a-z]{3,})/i;
        var ENGLISH_MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        
        $('td, span, div, p, time, a').each(function() {
            var $this = $(this);
            if ($this.attr('data-persian-converted') === 'true') return;
            
            // Only process leaf nodes (elements with no element children, only text)
            if ($this.children().length === 0) {
                var text = $this.text().trim();
                if (!text) return;

                var match = text.match(auditDateRegex);
                var isoMatch = text.match(isoDateRegex);
                var sysMatch1 = text.match(sysDateRegex1);
                var sysMatch2 = text.match(sysDateRegex2);
                var sysMatch3 = text.match(sysDateRegex3);
                var sysMatch4 = text.match(sysDateRegex4);
                var sysMatch5 = text.match(sysDateRegex5);
                var sysMatch6 = text.match(sysDateRegex6);

                var yearStr, monthStr, dayStr, timeStr = '', tzStr = '';
                var matchedOriginal = '';

                if (match) {
                    matchedOriginal = match[0];
                    monthStr = match[1]; dayStr = match[2]; yearStr = match[3];
                    timeStr = match[4]; tzStr = match[5];
                } else if (sysMatch1) {
                    matchedOriginal = sysMatch1[0];
                    dayStr = sysMatch1[1]; monthStr = sysMatch1[2]; yearStr = sysMatch1[3];
                } else if (sysMatch2) {
                    matchedOriginal = sysMatch2[0];
                    dayStr = sysMatch2[1]; monthStr = sysMatch2[2]; yearStr = "20" + sysMatch2[3];
                    timeStr = sysMatch2[4] || '';
                } else if (sysMatch3) {
                    matchedOriginal = sysMatch3[0];
                    monthStr = sysMatch3[1]; dayStr = sysMatch3[2]; timeStr = sysMatch3[3]; yearStr = sysMatch3[4];
                } else if (sysMatch4) {
                    matchedOriginal = sysMatch4[0];
                    // US Format M/D/Y expected
                    monthStr = sysMatch4[1]; dayStr = sysMatch4[2]; 
                    yearStr = sysMatch4[3];
                    if (yearStr.length === 2) yearStr = "20" + yearStr;
                    timeStr = sysMatch4[4];
                } else if (sysMatch5) {
                    matchedOriginal = sysMatch5[0];
                    monthStr = sysMatch5[1]; dayStr = sysMatch5[2]; yearStr = sysMatch5[3];
                } else if (sysMatch6) {
                    var mIdx = -1;
                    var mStr = sysMatch6[2].toLowerCase();
                    for (var i = 0; i < ENGLISH_MONTHS_FULL.length; i++) {
                        if (ENGLISH_MONTHS_FULL[i].indexOf(mStr) === 0) {
                            mIdx = i;
                            break;
                        }
                    }
                    if (mIdx !== -1 && typeof toJalaali !== 'undefined' && typeof PERSIAN_MONTHS !== 'undefined') {
                        try {
                            var gy = new Date().getFullYear();
                            var gd = parseInt(sysMatch6[1], 10);
                            var jDate = toJalaali(gy, mIdx + 1, gd);
                            var persianDateStr = jDate.jd + '/' + PERSIAN_MONTHS[jDate.jm - 1];
                            var replacement = text.replace(sysMatch6[0], persianDateStr);
                            $this.text(replacement);
                            $this.attr('data-persian-converted', 'true');
                            $this.attr('title', text);
                            convertedCount++;
                        } catch (e) {}
                    }
                    return; // Skip the rest for sysMatch6
                }

                if (matchedOriginal) {
                    var monthIndex = -1;
                    if (sysMatch4) {
                        // For numerical months
                        monthIndex = parseInt(monthStr, 10) - 1;
                    } else {
                        monthStr = monthStr.toLowerCase();
                        for (var i = 0; i < ENGLISH_MONTHS_FULL.length; i++) {
                            if (ENGLISH_MONTHS_FULL[i].indexOf(monthStr) === 0) {
                                monthIndex = i;
                                break;
                            }
                        }
                    }
                    
                    if (monthIndex !== -1 && typeof toJalaali !== 'undefined') {
                        try {
                            var jDate = toJalaali(parseInt(yearStr, 10), monthIndex + 1, parseInt(dayStr, 10));
                            var persianDateStr = formatPersianDateSlash(jDate.jy, jDate.jm, jDate.jd);
                            
                            var finalStr = persianDateStr;
                            if (timeStr) finalStr += ' ' + timeStr;
                            if (tzStr) finalStr += ' ' + tzStr;

                            var replacement = text.replace(matchedOriginal, finalStr);
                            replacement = replacement.replace(/Start:/gi, 'شروع:')
                                                     .replace(/End:/gi, 'پایان:')
                                                     .replace(/Target start:/gi, 'شروع هدف:')
                                                     .replace(/Target end:/gi, 'پایان هدف:')
                                                     .replace(/days ago/gi, 'روز پیش')
                                                     .replace(/day ago/gi, 'روز پیش')
                                                     .replace(/months ago/gi, 'ماه پیش')
                                                     .replace(/month ago/gi, 'ماه پیش')
                                                     .replace(/years ago/gi, 'سال پیش')
                                                     .replace(/year ago/gi, 'سال پیش');
                            $this.text(replacement);
                            $this.attr('data-persian-converted', 'true');
                            $this.attr('title', text);
                        } catch (e) { }
                    }
                } else if (isoMatch) {
                    try {
                        var year = parseInt(isoMatch[1], 10);
                        var month = parseInt(isoMatch[2], 10);
                        var day = parseInt(isoMatch[3], 10);
                        var time = isoMatch[4];
                        if (typeof toJalaali !== 'undefined') {
                            var jDate = toJalaali(year, month, day);
                            var persianDateStr = formatPersianDateSlash(jDate.jy, jDate.jm, jDate.jd);
                            var replacement = text.replace(isoMatch[0], persianDateStr + ' ' + time);
                            $this.text(replacement);
                            $this.attr('data-persian-converted', 'true');
                            $this.attr('title', text);
                        }
                    } catch (e) {}
                }
            }
        });
    }

    // Convert Issue Search/Navigator table dates to Persian format (YYYY/MM/DD)
    function convertIssueSearchDates($) {
        logDebug('=== Converting Issue Search Dates ===');

        var dateColumnSelectors = [
            // Issue Navigator table cells
            '.issue-table td.created',
            '.issue-table td.updated',
            '.issue-table td.duedate',
            '.issue-table td.resolutiondate',
            '.issue-table td[class*="customfield"]',
            // Navigator content
            '.navigator-content td.created',
            '.navigator-content td.updated',
            '.navigator-content td.duedate',
            // Issue table wrapper
            '.issuetable td.created',
            '.issuetable td.updated',
            '.issuetable td.duedate',
            // Data attributes
            'td[data-field-id="created"]',
            'td[data-field-id="updated"]',
            'td[data-field-id="duedate"]',
            'td[data-field-id="resolutiondate"]',
            'td[data-field-id*="customfield"]',
            // Time elements in tables
            '.issuerow td time',
            '.issuerow td .date'
        ];

        var convertedCount = 0;

        $(dateColumnSelectors.join(',')).each(function () {
            var $el = $(this);

            // Skip already converted
            if ($el.data('pc-search-converted')) {
                return;
            }

            var text = $el.text().trim();

            // Skip empty or relative dates
            if (!text || text.match(/ago|now|yesterday|tomorrow/i)) {
                return;
            }

            // Try to parse the date
            var parsed = parseJiraDate(text);
            if (parsed) {
                var jDate = toJalaali(parsed.year, parsed.month, parsed.day);
                var persianDateStr = formatPersianDateSlash(jDate.jy, jDate.jm, jDate.jd);

                // Check if there's a time component
                var timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                if (timeMatch) {
                    var hour = parseInt(timeMatch[1], 10);
                    var minute = parseInt(timeMatch[2], 10);
                    var ampm = timeMatch[3];

                    // Convert to 24-hour format
                    if (ampm) {
                        if (ampm.toUpperCase() === 'PM' && hour !== 12) {
                            hour += 12;
                        } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
                            hour = 0;
                        }
                    }

                    persianDateStr = formatPersianDateTime24(jDate.jy, jDate.jm, jDate.jd, hour, minute);
                }

                $el.attr('title', text + ' = ' + persianDateStr);
                $el.text(persianDateStr);
                $el.data('pc-search-converted', true);
                $el.css({
                    'direction': 'ltr',
                    'unicode-bidi': 'embed',
                    'font-family': 'Tahoma, Arial, sans-serif'
                });

                logDebug('Converted search date: ' + text + ' → ' + persianDateStr);
                convertedCount++;
            }
        });

        logDebug('Issue Search dates converted: ' + convertedCount);
    }

    // ========== DATE FORMAT SETTINGS ==========
    // Cache for date format settings (loaded from Jira settings)
    var DATE_FORMAT_CACHE = {
        loaded: false,
        dateFormat: 'dd/MMM/yyyy',
        dateTimeFormat: 'dd/MMM/yyyy h:mm a',
        dateFormatJS: '%e/%b/%Y',
        dateTimeFormatJS: '%e/%b/%Y %I:%M %p'
    };

    // Fetch date format settings from REST API
    function fetchDateFormatSettings() {
        if (DATE_FORMAT_CACHE.loaded) {
            logDebug('Date format settings already loaded from cache');
            return;
        }

        // Try to get base URL
        var baseUrl = AJS && AJS.contextPath ? AJS.contextPath() : '';
        var apiUrl = baseUrl + '/rest/persian-calendar/1.0/date-formats';

        logInfo('Fetching date format settings from: ' + apiUrl);

        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', apiUrl, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            var data = JSON.parse(xhr.responseText);
                            DATE_FORMAT_CACHE.dateFormat = data.dateFormat || DATE_FORMAT_CACHE.dateFormat;
                            DATE_FORMAT_CACHE.dateTimeFormat = data.dateTimeFormat || DATE_FORMAT_CACHE.dateTimeFormat;
                            DATE_FORMAT_CACHE.dateFormatJS = data.dateFormatJS || DATE_FORMAT_CACHE.dateFormatJS;
                            DATE_FORMAT_CACHE.dateTimeFormatJS = data.dateTimeFormatJS || DATE_FORMAT_CACHE.dateTimeFormatJS;
                            DATE_FORMAT_CACHE.loaded = true;
                            logInfo('Date format settings loaded successfully', DATE_FORMAT_CACHE);
                        } catch (e) {
                            logWarn('Failed to parse date format response: ' + e.message);
                        }
                    } else {
                        logWarn('Failed to fetch date formats (status ' + xhr.status + '), using defaults');
                    }
                }
            };
            xhr.send();
        } catch (e) {
            logWarn('Error fetching date formats: ' + e.message + ', using defaults');
        }
    }


    // ... (rest of the code)

    // Parse date format pattern and format a date accordingly
    function formatDateWithPattern(year, month, day, pattern) {
        // pattern examples: d/MMM/yy, dd/MMM/yyyy, yyyy-MM-dd
        var yyyy = year.toString();
        // Force 4-digit year for any year > 1000 to prevent '00xx' database errors
        var yearValue = (year > 1000) ? yyyy : (year % 100 < 10 ? '0' : '') + (year % 100);
        
        var MMM = GREGORIAN_MONTHS[month - 1];
        var MM = (month < 10 ? '0' : '') + month;
        var M = month.toString();
        var dd = (day < 10 ? '0' : '') + day;
        var d = day.toString();

        var result = pattern;
        // Use NUMERIC placeholders ONLY to avoid any collision with letters (y, M, d, a, h, m)
        result = result.replace(/yyyy/g, '[[1]]');
        result = result.replace(/yy/g, '[[2]]');
        result = result.replace(/MMM/g, '[[3]]');
        result = result.replace(/MM/g, '[[4]]');
        result = result.replace(/M/g, '[[5]]');
        result = result.replace(/dd/g, '[[6]]');
        result = result.replace(/d/g, '[[7]]');

        result = result.replace(/\[\[1\]\]/g, yyyy);
        result = result.replace(/\[\[2\]\]/g, yearValue);
        result = result.replace(/\[\[3\]\]/g, MMM);
        result = result.replace(/\[\[4\]\]/g, MM);
        result = result.replace(/\[\[5\]\]/g, M);
        result = result.replace(/\[\[6\]\]/g, dd);
        result = result.replace(/\[\[7\]\]/g, d);

        return result;
    }

    // Jalaali conversion functions
    function toJalaali(gy, gm, gd) {
        return d2j(g2d(gy, gm, gd));
    }

    function toGregorian(jy, jm, jd) {
        return d2g(j2d(jy, jm, jd));
    }

    function jalaaliMonthLength(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        return isLeapJalaaliYear(jy) ? 30 : 29;
    }

    function isLeapJalaaliYear(jy) {
        return jalCal(jy).leap === 0;
    }

    function jalCal(jy) {
        var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
        var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump, leap, leapG, march, n, i;
        for (i = 1; i < bl; i += 1) {
            jm = breaks[i];
            jump = jm - jp;
            if (jy < jm) break;
            leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
            jp = jm;
        }
        n = jy - jp;
        leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
        if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
        leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
        march = 20 + leapJ - leapG;
        if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
        leap = mod(mod(n + 1, 33) - 1, 4);
        if (leap === -1) leap = 4;
        return { leap: leap, gy: gy, march: march };
    }

    function j2d(jy, jm, jd) {
        var r = jalCal(jy);
        return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
    }

    function d2j(jdn) {
        var gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy), jdn1f = g2d(gy, 3, r.march), jd, jm, k;
        k = jdn - jdn1f;
        if (k >= 0) {
            if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy: jy, jm: jm, jd: jd }; }
            else k -= 186;
        } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
        jm = 7 + div(k, 30);
        jd = mod(k, 30) + 1;
        return { jy: jy, jm: jm, jd: jd };
    }

    function g2d(gy, gm, gd) {
        var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
        d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
        return d;
    }

    function d2g(jdn) {
        var j, i, gd, gm, gy;
        j = 4 * jdn + 139361631;
        j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
        i = div(mod(j, 1461), 4) * 5 + 308;
        gd = div(mod(i, 153), 5) + 1;
        gm = mod(div(i, 153), 12) + 1;
        gy = div(j, 1461) - 100100 + div(8 - gm, 6);
        return { gy: gy, gm: gm, gd: gd };
    }

    function div(a, b) { return ~~(a / b); }
    function mod(a, b) { return a - ~~(a / b) * b; }

    // Parse Jira date format - supports multiple formats based on DATE_FORMAT_CACHE
    function parseJiraDate(dateStr) {
        if (!dateStr) return null;
        
        // Quietly ignore if already contains Persian characters or non-ASCII symbols
        if (/[^\x00-\x7F]/.test(dateStr)) {
            return null;
        }

        logDebug('Parsing date: ' + dateStr);

        // Try multiple parsing strategies
        var result = null;

        // Strategy 1: Parse based on current format (d/MMM/yy or dd/MMM/yy)
        result = parseDateByPattern(dateStr, DATE_FORMAT_CACHE.dateFormat);
        if (result && result.year < 1500) return null; // Already Jalali
        if (result) return result;

        // Strategy 2: Try common Jira formats
        var commonFormats = ['d/MMM/yy', 'dd/MMM/yy', 'dd/MMM/yyyy', 'd/MMM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MMM-yy'];
        for (var i = 0; i < commonFormats.length; i++) {
            result = parseDateByPattern(dateStr, commonFormats[i]);
            if (result && result.year < 1500) return null; // Already Jalali
            if (result) return result;
        }

        // Strategy 3: Auto-detect format
        result = autoDetectAndParse(dateStr);
        if (result && result.year < 1500) return null; // Already Jalali
        if (result) return result;

        logWarn('Could not parse date: ' + dateStr);
        return null;
    }

    // Parse date string based on format pattern
    function parseDateByPattern(dateStr, pattern) {
        if (!dateStr || !pattern) return null;

        var str = dateStr.trim().split(/\s+\d{1,2}:/)[0].trim(); // Remove time part if present
        var day, month, year;

        // Determine separator
        var separator = '/';
        if (str.indexOf('-') !== -1) separator = '-';
        if (str.indexOf('.') !== -1) separator = '.';

        var parts = str.split(separator);
        if (parts.length < 3) return null;

        // Determine order from pattern
        var patternLower = pattern.toLowerCase();
        var patternParts = pattern.split(/[\/\-\.]/);

        try {
            if (patternParts.length >= 3) {
                for (var i = 0; i < 3; i++) {
                    var p = patternParts[i].toLowerCase();
                    if (p.indexOf('y') !== -1) {
                        year = parseInt(parts[i], 10);
                        if (year < 100) year += 2000;
                    } else if (p.indexOf('mmm') !== -1) {
                        // Month as abbreviation (Jan, Feb, etc.)
                        var mIdx = GREGORIAN_MONTHS.indexOf(parts[i]);
                        if (mIdx === -1) return null;
                        month = mIdx + 1;
                    } else if (p.indexOf('m') !== -1 && p.indexOf('mmm') === -1) {
                        // Month as number
                        month = parseInt(parts[i], 10);
                    } else if (p.indexOf('d') !== -1) {
                        day = parseInt(parts[i], 10);
                    }
                }
            }

            if (day && month && year && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
                var result = { year: year, month: month, day: day };
                logDebug('Parsed date result', result);
                return result;
            }
        } catch (e) {
            logDebug('Pattern parsing failed: ' + e.message);
        }

        return null;
    }

    // Auto-detect and parse common date formats
    function autoDetectAndParse(dateStr) {
        var str = dateStr.trim().split(/\s+\d{1,2}:/)[0].trim();

        // Try d/MMM/yy format (most common Jira format)
        var match1 = str.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})$/);
        if (match1) {
            var mIdx = GREGORIAN_MONTHS.indexOf(match1[2]);
            if (mIdx !== -1) {
                var y = parseInt(match1[3], 10);
                if (y < 100) y += 2000;
                return { year: y, month: mIdx + 1, day: parseInt(match1[1], 10) };
            }
        }

        // Try yyyy-MM-dd format (ISO)
        var match2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match2) {
            return { year: parseInt(match2[1], 10), month: parseInt(match2[2], 10), day: parseInt(match2[3], 10) };
        }

        // Try MM/dd/yyyy format (US)
        var match3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match3) {
            return { year: parseInt(match3[3], 10), month: parseInt(match3[1], 10), day: parseInt(match3[2], 10) };
        }

        // Try dd-MMM-yyyy format
        var match4 = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
        if (match4) {
            var mIdx2 = GREGORIAN_MONTHS.indexOf(match4[2]);
            if (mIdx2 !== -1) {
                var y2 = parseInt(match4[3], 10);
                if (y2 < 100) y2 += 2000;
                return { year: y2, month: mIdx2 + 1, day: parseInt(match4[1], 10) };
            }
        }

        // Try "Jun 15, 2026" or "June 15 2026" format (Written English)
        var match5 = str.match(/^([A-Za-z]{3,10})\s+(\d{1,2}),?\s+(\d{4})$/);
        if (match5) {
            var mName = match5[1].substring(0, 3); // Get first 3 letters
            var mNameCap = mName.charAt(0).toUpperCase() + mName.slice(1).toLowerCase();
            var mIdx = GREGORIAN_MONTHS.indexOf(mNameCap);
            if (mIdx !== -1) {
                return { year: parseInt(match5[3], 10), month: mIdx + 1, day: parseInt(match5[2], 10) };
            }
        }

        // Try "15 Jun 2026" or "15 June, 2026" format
        var match6 = str.match(/^(\d{1,2})\s+([A-Za-z]{3,10}),?\s+(\d{4})$/);
        if (match6) {
            var mName = match6[2].substring(0, 3); // Get first 3 letters
            var mNameCap = mName.charAt(0).toUpperCase() + mName.slice(1).toLowerCase();
            var mIdx = GREGORIAN_MONTHS.indexOf(mNameCap);
            if (mIdx !== -1) {
                return { year: parseInt(match6[3], 10), month: mIdx + 1, day: parseInt(match6[1], 10) };
            }
        }

        return null;
    }

    function formatJiraDate(year, month, day) {
        // Use dynamic format from cache, fallback to default
        return formatDateWithPattern(year, month, day, DATE_FORMAT_CACHE.dateFormat);
    }

    function formatJiraDateTime(year, month, day, hour, minute, ampm) {
        // Format date part using dynamic format
        var dateFormatPart = DATE_FORMAT_CACHE.dateTimeFormat.split(' ')[0] || 'dd/MMM/yyyy';
        var dateStr = formatDateWithPattern(year, month, day, dateFormatPart);

        // Format time part (h:mm a)
        var minStr = minute < 10 ? '0' + minute : '' + minute;
        return dateStr + ' ' + hour + ':' + minStr + ' ' + ampm;
    }

    function formatPersianDate(jy, jm, jd) {
        return jd + ' ' + PERSIAN_MONTHS[jm - 1] + ' ' + jy;
    }

    // Add CSS styles
    function addStyles() {
        if (document.getElementById('persian-calendar-styles')) {
            logDebug('Styles already added');
            return;
        }
        logInfo('Adding CSS styles');

        var css = [
            '.pc-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2000000000; }',
            '.pc-popup { position: absolute; z-index: 2000000001; background: #fff; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); width: 340px; padding: 12px; direction: rtl; font-family: Tahoma, Arial, sans-serif; }',
            '.pc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; gap: 2px; }',
            '.pc-header button { color: #fff !important; border: none; border-radius: 4px; padding: 6px 2px; cursor: pointer; font-size: 11px; white-space: nowrap; min-width: 55px; text-align: center; transition: all 0.2s; font-weight: bold; background: #f39c12 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }',
            '.pc-header button:hover { background: #e67e22 !important; box-shadow: 0 3px 6px rgba(0,0,0,0.16); transform: translateY(-1px); }',
            '.pc-title { font-weight: bold; font-size: 16px; color: #172b4d; flex-grow: 1; text-align: center; min-width: 80px; }',
            '.pc-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 6px; }',
            '.pc-weekdays span { font-size: 12px; color: #6b778c; padding: 6px 0; font-weight: bold; }',
            '.pc-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }',
            '.pc-day { text-align: center; padding: 10px 4px; cursor: pointer; border-radius: 4px; font-size: 14px; transition: all 0.1s; }',
            '.pc-day:not(.empty):hover { background: #feeebf; }',
            '.pc-day.empty { cursor: default; }',
            '.pc-day.holiday, .pc-day.friday { color: #d04437 !important; font-weight: bold; background: #fff5f5; }',
            '.pc-day.holiday:hover, .pc-day.friday:hover { background: #feebeb; }',
            '.pc-day.today { background: #fff3e0; color: #e65100; font-weight: bold; border: 1px solid #ffcc80; }',
            '.pc-day.selected { background: #f39c12 !important; color: #fff !important; }',
            '.pc-footer { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee; gap: 8px; }',
            '.pc-footer button { flex: 1; padding: 8px 5px; border: none !important; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; color: #fff !important; background: #f39c12 !important; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }',
            '.pc-footer button:hover { background: #e67e22 !important; box-shadow: 0 3px 8px rgba(243,156,18,0.3); transform: translateY(-1px); }',
            '.pc-time-picker { display: flex; align-items: center; justify-content: center; margin-top: 12px; padding: 10px; background: #fff8e1; border-radius: 6px; gap: 6px; border: 1px solid #ffe082; }',
            '.pc-time-picker label { font-size: 12px; font-weight: bold; color: #e65100; margin-left: 4px; }',
            '.pc-time-picker select { padding: 4px; border: 1px solid #ffcc80; border-radius: 3px; font-size: 13px; background: #fff; color: #5d4037; cursor: pointer; }',
            '.pc-time-picker select:focus { border-color: #f39c12; outline: none; box-shadow: 0 0 0 2px rgba(243,156,18,0.2); }',
            '.pc-time-picker select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; background: #fff; cursor: pointer; }',
            '.pc-time-picker span { font-size: 16px; font-weight: bold; color: #5e6c84; }'
        ].join('\n');

        var style = document.createElement('style');
        style.id = 'persian-calendar-styles';
        style.textContent = css;
        document.head.appendChild(style);
        logInfo('CSS styles added successfully');
    }

    // Create and show Persian calendar popup
    function showPersianCalendar($input, $originalInput, onSelect, hideButtons) {
        // Check license before showing calendar
        checkLicenseStatus(function (license) {
            if (!license.enabled) {
                showLicenseExpiredMessage();
                return;
            }
            _showPersianCalendarImpl($input, $originalInput, onSelect, hideButtons);
        });
    }

    function _showPersianCalendarImpl($input, $originalInput, onSelect, hideButtons) {
        logInfo('Opening Persian calendar popup (hideButtons: ' + !!hideButtons + ')');

        var $existing = document.querySelector('.pc-popup');
        if ($existing) $existing.remove();
        var $overlay = document.querySelector('.pc-overlay');
        if ($overlay) $overlay.remove();

        var today = new Date();
        var todayJ = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        logDebug('Today in Jalaali', todayJ);

        // Get current value
        var currentJDate = null;
        var currentVal = $originalInput.val ? $originalInput.val() : $originalInput.value;
        logDebug('Current input value: ' + currentVal);

        if (currentVal) {
            var gDate = parseJiraDate(currentVal);
            if (gDate) {
                currentJDate = toJalaali(gDate.year, gDate.month, gDate.day);
                logDebug('Current date in Jalaali', currentJDate);
            }
        }

        var selectedDate = currentJDate ? { jy: currentJDate.jy, jm: currentJDate.jm, jd: currentJDate.jd } : null;
        var viewYear = selectedDate ? selectedDate.jy : todayJ.jy;
        var viewMonth = selectedDate ? selectedDate.jm : todayJ.jm;

        var inputEl = $input[0] || $input;

        // Create overlay
        var overlay = document.createElement('div');
        overlay.className = 'pc-overlay';
        document.body.appendChild(overlay);
        var openTime = Date.now();

        // Add a body class to aggressively hide any Atlaskit popups while our calendar is open
        document.body.classList.add('pc-calendar-is-open');

        // Create popup
        var popup = document.createElement('div');
        popup.className = 'pc-popup react-datepicker-ignore-onclickoutside';
        
        if (typeof popup.showPopover === 'function') {
            popup.popover = "manual";
        }
        
        document.body.appendChild(popup);
        if (typeof popup.showPopover === 'function') {
            popup.showPopover();
        }

        // Position popup - smart positioning relative to viewport
        var rect = inputEl.getBoundingClientRect();
        
        var popupHeight = 420; // Approximate height of popup
        var popupWidth = 320; // Approximate width
        var viewportHeight = window.innerHeight;
        var viewportWidth = window.innerWidth;

        // Determine if popup should appear above or below
        var spaceBelow = viewportHeight - rect.bottom;
        var spaceAbove = rect.top;
        var topPos, leftPos;

        if (spaceBelow >= popupHeight || spaceBelow > spaceAbove) {
            // Position below the input
            topPos = rect.bottom + window.scrollY + 5;
        } else {
            // Position above the input
            topPos = rect.top + window.scrollY - popupHeight - 5;
        }

        // Ensure left position doesn't go off-screen
        leftPos = rect.left + window.scrollX;
        if (leftPos + popupWidth > viewportWidth) {
            leftPos = viewportWidth - popupWidth - 10;
        }
        if (leftPos < 10) leftPos = 10;

        popup.style.position = 'absolute';
        popup.style.top = topPos + 'px';
        popup.style.left = leftPos + 'px';
        popup.style.maxHeight = (viewportHeight - 40) + 'px';
        popup.style.overflowY = 'auto';
        logDebug('Popup positioned at', { top: popup.style.top, left: popup.style.left, spaceBelow: spaceBelow, spaceAbove: spaceAbove });

        function render() {
            logDebug('Rendering calendar for', { year: viewYear, month: viewMonth });

            // Final layout for v10.4.12:
            // User requested order from LEFT to RIGHT: << < Title > >>
            var html = '<div class="pc-header">';
            html += '<button type="button" class="pc-next-year" title="سال بعد">سال بعد</button>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">ماه بعد</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">ماه قبل</button>';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">سال قبل</button>';
            html += '</div>';

            // Weekday headers: In RTL, grid goes right-to-left
            // Position 0 (rightmost) = Saturday, Position 6 (leftmost) = Friday
            html += '<div class="pc-weekdays">';
            for (var w = 0; w < 7; w++) {
                html += '<span>' + PERSIAN_WEEKDAYS[w] + '</span>';
            }
            html += '</div>';

            html += '<div class="pc-days">';

            var gFirst = toGregorian(viewYear, viewMonth, 1);
            var firstDate = new Date(gFirst.gy, gFirst.gm - 1, gFirst.gd);
            var firstDayOfWeek = firstDate.getDay();
            // Convert to Saturday-based week (Saturday = 0)
            var persianFirstDay = (firstDayOfWeek + 1) % 7;
            logDebug('First day calculation', {
                gregorianFirst: gFirst,
                jsDay: firstDayOfWeek,
                persianFirstDay: persianFirstDay
            });

            var daysInMonth = jalaaliMonthLength(viewYear, viewMonth);

            // Empty cells: persianFirstDay = 0 means Saturday (first column in RTL)
            // So we need persianFirstDay empty cells before day 1
            logDebug('Empty cells count: ' + persianFirstDay);
            for (var e = 0; e < persianFirstDay; e++) {
                html += '<span class="pc-day empty"></span>';
            }

            // Days
            for (var d = 1; d <= daysInMonth; d++) {
                var isSelected = selectedDate && (d === selectedDate.jd && viewMonth === selectedDate.jm && viewYear === selectedDate.jy);
                var isToday = (d === todayJ.jd && viewMonth === todayJ.jm && viewYear === todayJ.jy);

                // Highlight Fridays and Holidays with Occasions
                var weekdayIdx = (persianFirstDay + d - 1) % 7;
                var holidayKey = viewYear + '-' + viewMonth + '-' + d;
                var isFriday = (weekdayIdx === 6);
                var holidayOccasion = IRAN_HOLIDAYS[holidayKey];

                var classes = 'pc-day';
                if (isSelected) classes += ' selected';
                if (isToday) classes += ' today';

                var titleAttr = '';
                if (holidayOccasion) {
                    classes += ' holiday';
                    titleAttr = ' title="' + holidayOccasion + '"';
                } else if (isFriday) {
                    classes += ' friday';
                    titleAttr = ' title="جمعه"';
                }

                html += '<span class="' + classes + '" data-day="' + d + '"' + titleAttr + '>' + d + '</span>';
            }

            html += '</div>';

            if (!hideButtons) {
                html += '<div class="pc-footer">';
                html += '<button type="button" class="pc-confirm">تأیید</button>';
                html += '<button type="button" class="pc-today">امروز</button>';
                html += '<button type="button" class="pc-clear">پاک کردن</button>';
                html += '</div>';
            }

            popup.innerHTML = html;
        }

        function close() {
            document.body.classList.remove('pc-calendar-is-open');
            logDebug('Closing calendar popup');
            popup.remove();
            overlay.remove();
        }

        function selectDay(day) {
            logInfo('Day selected: ' + day);
            selectedDate = { jy: viewYear, jm: viewMonth, jd: day };
            render();
        }

        function confirm() {
            if (selectedDate) {
                logInfo('Confirming date selection', selectedDate);
                onSelect(selectedDate);
            }
            close();
        }

        function handlePopupEvents(e) {
            // Stop propagation to prevent closing parent popups/dropdowns
            e.stopPropagation();
            if (e.type === 'click') {
                var target = e.target;
                if (target.classList.contains('pc-prev-year')) {
                    viewYear--;
                    logDebug('Navigate to previous year: ' + viewYear);
                    render();
                } else if (target.classList.contains('pc-next-year')) {
                    viewYear++;
                    logDebug('Navigate to next year: ' + viewYear);
                    render();
                } else if (target.classList.contains('pc-prev-month')) {
                    viewMonth--;
                    if (viewMonth < 1) { viewMonth = 12; viewYear--; }
                    logDebug('Navigate to previous month: ' + viewMonth + '/' + viewYear);
                    render();
                } else if (target.classList.contains('pc-next-month')) {
                    viewMonth++;
                    if (viewMonth > 12) { viewMonth = 1; viewYear++; }
                    logDebug('Navigate to next month: ' + viewMonth + '/' + viewYear);
                    render();
                } else if (target.classList.contains('pc-day') && !target.classList.contains('empty')) {
                    selectDay(parseInt(target.dataset.day, 10));
                    confirm();
                } else if (target.classList.contains('pc-today')) {
                    logInfo('Today button clicked');
                    selectedDate = { jy: todayJ.jy, jm: todayJ.jm, jd: todayJ.jd };
                    onSelect(selectedDate);
                    close();
                } else if (target.classList.contains('pc-clear')) {
                    logInfo('Clear button clicked');
                    onSelect(null);
                    close();
                } else if (target.classList.contains('pc-confirm')) {
                    confirm();
                }
                e.preventDefault();
            }
        }

        // Event delegation with capture to prevent any other handlers from running
        popup.addEventListener('click', handlePopupEvents, true);
        popup.addEventListener('mousedown', handlePopupEvents, true);
        popup.addEventListener('mouseup', handlePopupEvents, true);
        popup.addEventListener('pointerdown', handlePopupEvents, true);
        popup.addEventListener('pointerup', handlePopupEvents, true);

        overlay.addEventListener('click', function (e) {
            if (Date.now() - openTime < 300) {
                logDebug('Ignoring overlay click too close to open time');
                return;
            }
            logDebug('Overlay clicked, closing');
            e.stopPropagation();
            close();
        }, true);
        overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); }, true);
        overlay.addEventListener('pointerdown', function(e) { e.stopPropagation(); }, true);

        render();
    }

    // Create and show Persian DateTime picker popup (Date + Time)
    function showPersianDateTimePicker($input, $originalInput, onSelect, hideButtons) {
        // Check license before showing calendar
        checkLicenseStatus(function (license) {
            if (!license.enabled) {
                showLicenseExpiredMessage();
                return;
            }
            _showPersianDateTimePickerImpl($input, $originalInput, onSelect, hideButtons);
        });
    }

    function _showPersianDateTimePickerImpl($input, $originalInput, onSelect, hideButtons) {
        logInfo('Opening Persian DateTime picker popup (hideButtons: ' + !!hideButtons + ')');

        var $existing = document.querySelector('.pc-popup');
        if ($existing) $existing.remove();
        var $overlay = document.querySelector('.pc-overlay');
        if ($overlay) $overlay.remove();

        var today = new Date();
        var todayJ = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
        logDebug('Today in Jalaali', todayJ);

        // Get current value and parse time
        var currentJDate = null;
        var currentHour = today.getHours();
        var currentMinute = today.getMinutes();
        var currentAmPm = currentHour >= 12 ? 'PM' : 'AM';

        var currentVal = $originalInput.val ? $originalInput.val() : $originalInput.value;
        logDebug('Current DateTime value: ' + currentVal);

        if (currentVal) {
            // Parse date part
            var gDate = parseJiraDate(currentVal);
            if (gDate) {
                currentJDate = toJalaali(gDate.year, gDate.month, gDate.day);
                logDebug('Current date in Jalaali', currentJDate);
            }

            // Parse time part (e.g., "5:23 PM" or "17:23")
            var timeMatch = currentVal.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (timeMatch) {
                currentHour = parseInt(timeMatch[1], 10);
                currentMinute = parseInt(timeMatch[2], 10);
                if (timeMatch[3]) {
                    currentAmPm = timeMatch[3].toUpperCase();
                } else {
                    currentAmPm = currentHour >= 12 ? 'PM' : 'AM';
                }
                // Convert to 12-hour format if needed
                if (currentHour > 12) {
                    currentHour = currentHour - 12;
                } else if (currentHour === 0) {
                    currentHour = 12;
                }
                logDebug('Parsed time: ' + currentHour + ':' + currentMinute + ' ' + currentAmPm);
            }
        }

        var selectedDate = currentJDate ? { jy: currentJDate.jy, jm: currentJDate.jm, jd: currentJDate.jd } : null;
        var selectedHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
        var selectedMinute = currentMinute;
        var selectedAmPm = currentAmPm;

        var viewYear = selectedDate ? selectedDate.jy : todayJ.jy;
        var viewMonth = selectedDate ? selectedDate.jm : todayJ.jm;

        // Create overlay
        var overlay = document.createElement('div');
        overlay.className = 'pc-overlay';
        document.body.appendChild(overlay);
        var openTime = Date.now();

        document.body.classList.add('pc-calendar-is-open');

        // Create popup
        var popup = document.createElement('div');
        popup.className = 'pc-popup react-datepicker-ignore-onclickoutside';
        
        if (typeof popup.showPopover === 'function') {
            popup.popover = "manual";
        }
        
        document.body.appendChild(popup);
        if (typeof popup.showPopover === 'function') {
            popup.showPopover();
        }

        // Position popup - smart positioning to avoid going off-screen
        var inputEl = $input[0] || $input;
        var rect = inputEl.getBoundingClientRect();
        var popupHeight = 480; // DateTime popup is taller due to time picker
        var popupWidth = 320;
        var viewportHeight = window.innerHeight;
        var viewportWidth = window.innerWidth;

        var spaceBelow = viewportHeight - rect.bottom;
        var spaceAbove = rect.top;
        var topPos, leftPos;

        if (spaceBelow >= popupHeight || spaceBelow > spaceAbove) {
            topPos = rect.bottom + window.scrollY + 5;
        } else {
            topPos = rect.top + window.scrollY - popupHeight - 5;
        }

        leftPos = rect.left + window.scrollX;
        if (leftPos + popupWidth > viewportWidth) {
            leftPos = viewportWidth - popupWidth - 10;
        }
        if (leftPos < 10) leftPos = 10;

        popup.style.top = topPos + 'px';
        popup.style.left = leftPos + 'px';
        popup.style.maxHeight = (viewportHeight - 40) + 'px';
        popup.style.overflowY = 'auto';
        logDebug('DateTime Popup positioned at', { top: popup.style.top, left: popup.style.left });

        function render() {
            logDebug('Rendering DateTime calendar for', { year: viewYear, month: viewMonth });

            var html = '<div class="pc-header" style="justify-content:space-between; align-items:center;">';
            html += '<button type="button" class="pc-next-year" title="سال بعد">سال بعد</button>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">ماه بعد</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">ماه قبل</button>';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">سال قبل</button>';
            html += '</div>';

            html += '<div class="pc-weekdays">';
            PERSIAN_WEEKDAYS.forEach(function (d) { html += '<span>' + d + '</span>'; });
            html += '</div>';

            html += '<div class="pc-days">';

            var gFirst = toGregorian(viewYear, viewMonth, 1);
            var dFirst = new Date(gFirst.gy, gFirst.gm - 1, gFirst.gd);
            var jsDay = dFirst.getDay();
            var persianFirstDay = (jsDay + 1) % 7;

            for (var i = 0; i < persianFirstDay; i++) {
                html += '<span class="pc-day empty"></span>';
            }

            var daysInMonth = jalaaliMonthLength(viewYear, viewMonth);
            for (var d = 1; d <= daysInMonth; d++) {
                var isSelected = selectedDate && (d === selectedDate.jd && viewMonth === selectedDate.jm && viewYear === selectedDate.jy);
                var isToday = (d === todayJ.jd && viewMonth === todayJ.jm && viewYear === todayJ.jy);

                // Highlight Fridays and Holidays with Occasions
                var weekdayIdx = (persianFirstDay + d - 1) % 7;
                var holidayKey = viewYear + '-' + viewMonth + '-' + d;
                var isFriday = (weekdayIdx === 6);
                var holidayOccasion = IRAN_HOLIDAYS[holidayKey];

                var cls = 'pc-day';
                if (isSelected) cls += ' selected';
                if (isToday) cls += ' today';

                var titleAttr = '';
                if (holidayOccasion) {
                    cls += ' holiday';
                    titleAttr = ' title="' + holidayOccasion + '"';
                } else if (isFriday) {
                    cls += ' friday';
                    titleAttr = ' title="جمعه"';
                }

                html += '<span class="' + cls + '" data-day="' + d + '"' + titleAttr + '>' + d + '</span>';
            }

            html += '</div>';

            // Time picker section
            html += '<div class="pc-time-picker">';
            html += '<label>ساعت:</label>';
            html += '<select class="pc-hour">';
            for (var h = 1; h <= 12; h++) {
                var sel = h === selectedHour ? ' selected' : '';
                html += '<option value="' + h + '"' + sel + '>' + (h < 10 ? '0' + h : h) + '</option>';
            }
            html += '</select>';
            html += '<span>:</span>';
            html += '<select class="pc-minute">';
            for (var m = 0; m < 60; m += 5) {
                var sel = m === selectedMinute || (m <= selectedMinute && m + 5 > selectedMinute) ? ' selected' : '';
                html += '<option value="' + m + '"' + sel + '>' + (m < 10 ? '0' + m : m) + '</option>';
            }
            html += '</select>';
            html += '<select class="pc-ampm">';
            html += '<option value="AM"' + (selectedAmPm === 'AM' ? ' selected' : '') + '>AM</option>';
            html += '<option value="PM"' + (selectedAmPm === 'PM' ? ' selected' : '') + '>PM</option>';
            html += '</select>';
            html += '</div>';

            if (!hideButtons) {
                html += '<div class="pc-footer">';
                html += '<button type="button" class="pc-confirm">تأیید</button>';
                html += '<button type="button" class="pc-today">الان</button>';
                html += '<button type="button" class="pc-clear">پاک کردن</button>';
                html += '</div>';
            }

            popup.innerHTML = html;

            // Attach change handlers for time inputs
            popup.querySelector('.pc-hour').addEventListener('change', function (e) {
                selectedHour = parseInt(e.target.value, 10);
            });
            popup.querySelector('.pc-minute').addEventListener('change', function (e) {
                selectedMinute = parseInt(e.target.value, 10);
            });
            popup.querySelector('.pc-ampm').addEventListener('change', function (e) {
                selectedAmPm = e.target.value;
            });
        }

        function close() {
            document.body.classList.remove('pc-calendar-is-open');
            logDebug('Closing DateTime picker popup');
            popup.remove();
            overlay.remove();
        }

        function selectDay(day) {
            selectedDate = { jy: viewYear, jm: viewMonth, jd: day };
            logDebug('Day selected', selectedDate);
            render();
            if (hideButtons) { confirm(); }
        }

        function confirm() {
            if (selectedDate) {
                // Combine date and time
                var result = {
                    jy: selectedDate.jy,
                    jm: selectedDate.jm,
                    jd: selectedDate.jd,
                    hour: selectedHour,
                    minute: selectedMinute,
                    ampm: selectedAmPm
                };
                logInfo('Confirming DateTime selection', result);
                onSelect(result);
            }
            close();
        }

        // Event delegation using capture phase
        function handlePopupEvents(e) {
            e.stopPropagation();
            if (e.type === 'click') {
                var target = e.target;
                if (target.classList.contains('pc-prev-year')) {
                    viewYear--;
                    render();
                } else if (target.classList.contains('pc-next-year')) {
                    viewYear++;
                    render();
                } else if (target.classList.contains('pc-prev-month')) {
                    viewMonth--;
                    if (viewMonth < 1) { viewMonth = 12; viewYear--; }
                    render();
                } else if (target.classList.contains('pc-next-month')) {
                    viewMonth++;
                    if (viewMonth > 12) { viewMonth = 1; viewYear++; }
                    render();
                } else if (target.classList.contains('pc-day') && !target.classList.contains('empty')) {
                    selectDay(parseInt(target.dataset.day, 10));
                } else if (target.classList.contains('pc-today')) {
                    logInfo('Now button clicked');
                    var now = new Date();
                    selectedDate = { jy: todayJ.jy, jm: todayJ.jm, jd: todayJ.jd };
                    selectedHour = now.getHours() > 12 ? now.getHours() - 12 : (now.getHours() === 0 ? 12 : now.getHours());
                    selectedMinute = Math.floor(now.getMinutes() / 5) * 5;
                    selectedAmPm = now.getHours() >= 12 ? 'PM' : 'AM';
                    confirm();
                } else if (target.classList.contains('pc-clear')) {
                    logInfo('Clear button clicked');
                    onSelect(null);
                    close();
                } else if (target.classList.contains('pc-confirm')) {
                    confirm();
                }
                e.preventDefault();
            }
        }

        popup.addEventListener('click', handlePopupEvents, true);
        popup.addEventListener('mousedown', handlePopupEvents, true);
        popup.addEventListener('mouseup', handlePopupEvents, true);
        popup.addEventListener('pointerdown', handlePopupEvents, true);
        popup.addEventListener('pointerup', handlePopupEvents, true);

        overlay.addEventListener('click', function (e) {
            if (Date.now() - openTime < 300) {
                logDebug('Ignoring overlay click too close to open time');
                return;
            }
            logDebug('Overlay clicked, closing');
            e.stopPropagation();
            close();
        }, true);
        overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); }, true);
        overlay.addEventListener('pointerdown', function(e) { e.stopPropagation(); }, true);

        render();
    }

    // Convert date displays on View page (sidebar dates like Due, Plan Date, etc.)
    function convertViewPageDates($) {
        logInfo('=== Converting View Page Dates ===');

        // Selectors for date display elements - ONLY read-only areas
        // NOTE: Do NOT convert editable fields in sidebar (#due-date, #customfield_*) 
        // as it breaks Jira's inline edit functionality
        var dateValueSelectors = [
            // Due date in detail view - ONLY time element (read-only display)
            '#due-date .value time[datetime]',
            '#customfield_10015-val time[datetime]',  // Plan Date - only time element
            // Generic date display patterns
            '.item-details .date-value',
            '.dates-module time[datetime]',
            // Any time element with datetime attribute (read-only display)
            '.details-layout time[datetime]',
            '#issuedetails time[datetime]',
            '#datesmodule time[datetime]',
            // Work Log / Activity section dates (based on HTML inspection)
            // The date is inside: .action-details > .subText > span.date
            '.subText .date',
            '.subText span.date',
            'span.date[data-datetime]',
            '.action-details .subText .date',
            '.actionContainer .date',
            '.actionContainer span.date',
            '.action-details .date',
            '.action-details span.date',
            '#activitymodule .date',
            '#activity-stream-issue-tab .date',
            '#worklog-tabpanel .date',
            '#worklog-tabpanel span.date',
            '.issue-data-block .date',
            // History Tab (Original/New values)
            'td.activity-old-val',
            'td.activity-new-val',
            '.activity-old-val',
            '.activity-new-val',
            // Livestamp elements
            '.activity-container .livestamp',
            '.actionContainer .livestamp',
            // Time elements
            '.actionContainer time',
            '.action-details time',
            '#activitymodule time',
            // ========== JSM Customer Portal specific selectors ==========
            // Request details page date fields
            'dd[data-test-id="duedate"]',
            'dd[data-test-id*="customfield_"]',
            'dd[data-test-cv-dummy-text]',
            '.cv-request-details dd',
            '.activity-item-request-fields dd',
            // Request fields in sidebar
            '.cv-request-current-value',
            '.cv-request-field-value',
            // Date display in request lists
            '.cv-request-list .date',
            '.cv-request-list time',
            // General JSM date displays
            '[data-test-id*="date"] dd',
            '[data-test-id*="Date"] dd',
            '.vp-activity-list dd'
        ];

        var convertedCount = 0;

        // Debug: Log how many elements match each selector individually
        logDebug('Checking selectors individually:');
        dateValueSelectors.forEach(function (sel) {
            var count = $(sel).length;
            if (count > 0) {
                logDebug('Selector "' + sel + '" matched ' + count + ' elements');
            }
        });

        $(dateValueSelectors.join(',')).each(function () {
            var $el = $(this);

            // Check if element was previously converted but text has changed back to Gregorian
            // This happens after inline edit saves - Jira replaces the element content
            if ($el.data('pc-converted')) {
                var currentText = $el.text().trim();
                // Check if the current text is a valid Gregorian date by trying to parse it
                if (parseJiraDate(currentText)) {
                    logDebug('Date was updated by Jira, resetting conversion flag: ' + currentText);
                    $el.removeData('pc-converted');
                } else {
                    // Already converted and still showing Persian
                    return;
                }
            }

            // Skip if inside an ACTIVE inline edit form (with visible input)
            // Only skip when inline edit is actually open, not after it closes
            var $parentForm = $el.closest('form');
            var hasActiveInput = $parentForm.length > 0 && $parentForm.find('input:visible, textarea:visible').length > 0;

            if (hasActiveInput ||
                $el.closest('.inline-edit-fields:visible').length > 0 ||
                $el.closest('.editable-field.active').length > 0 ||
                $el.closest('.aui-inline-dialog:visible').length > 0 ||
                $el.closest('.jira-dialog:visible').length > 0 ||
                $el.closest('.ajs-layer:visible').length > 0) {
                logDebug('Skipped element inside ACTIVE inline edit: ' + $el.text().trim());
                return;
            }

            var fullText = $el.text().trim();

            // Skip if already converted by duration converter or containing Persian numerals
            if ($el.data('pc-duration-converted') || fullText.match(/[۰-۹]/)) {
                return;
            }

            // Debug: Log each element found
            logDebug('Found element with text: "' + fullText + '" | tag: ' + $el.prop('tagName') + ' | class: ' + $el.attr('class'));

            // Skip relative dates like "17 hours ago", "Just now", etc.
            if (fullText.match(/ago|now|yesterday|tomorrow|hours|minutes|seconds/i)) {
                logDebug('Skipped relative date: ' + fullText);
                return;
            }

            // Handle prefixes like "Original: " or "New: " (Common in History tab)
            var prefix = '';
            var textToParse = fullText;
            var prefixMatch = fullText.match(/^(Original|New|Old Value|New Value):\s*/i);
            if (prefixMatch) {
                prefix = prefixMatch[0];
                textToParse = fullText.substring(prefix.length).trim();
            }

            // Try to parse Jira date format (d/MMM/yy or dd/MMM/yy h:mm a)
            // Extract date part first (before any time)
            var datePart = textToParse.split(/\s+\d{1,2}:/)[0].trim();
            var timePart = '';

            // Match time with AM/PM format (e.g., "7:11 PM" or "12:30 AM")
            var timeMatch = textToParse.match(/\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (timeMatch) {
                var hour = parseInt(timeMatch[1], 10);
                var minute = timeMatch[2];
                var ampm = timeMatch[3].toUpperCase();

                // Convert to 24-hour format
                if (ampm === 'PM' && hour !== 12) {
                    hour += 12;
                } else if (ampm === 'AM' && hour === 12) {
                    hour = 0;
                }

                // Format with leading zero
                var hour24 = (hour < 10 ? '0' : '') + hour;
                timePart = ' ' + hour24 + ':' + minute;
            } else {
                // Try to match time without AM/PM (already 24-hour format)
                var time24Match = textToParse.match(/\s+(\d{1,2}:\d{2})(?!\s*[AP]M)/i);
                if (time24Match) {
                    timePart = ' ' + time24Match[1];
                }
            }

            var parsed = parseJiraDate(datePart);
            if (parsed) {
                var jDate = toJalaali(parsed.year, parsed.month, parsed.day);
                var persianDateStr = formatPersianDate(jDate.jy, jDate.jm, jDate.jd);
                var persianText = persianDateStr + timePart;

                // Save original for tooltip
                $el.attr('title', fullText + ' = ' + persianText);

                // Use HTML with proper RTL handling to prevent bidirectional text mixing
                // The LRM (Left-to-Right Mark) character helps separate the time from Persian text
                var lrm = '\u200E';  // Left-to-Right Mark
                var rlm = '\u200F';  // Right-to-Left Mark

                var displayText = persianDateStr;
                if (timePart) {
                    displayText = displayText + lrm + timePart;
                }

                // Prepend original prefix if it existed
                if (prefix) {
                    displayText = prefix + rlm + ' ' + displayText;
                }

                $el.text(displayText);
                $el.data('pc-converted', true);
                $el.css({
                    'direction': 'rtl',
                    'unicode-bidi': 'embed'
                });

                logInfo('Converted date: ' + fullText + ' → ' + displayText);
                convertedCount++;
            } else {
                logDebug('Could not parse date: "' + fullText + '" (datePart: "' + datePart + '")');
            }
        });

        logInfo('View page dates converted: ' + convertedCount);

        // Convert full JavaScript-style dates (e.g. for ScriptRunner or dynamic outputs)
        try {
            convertFullEnglishDates($);
        } catch (e) {
            logError('Error converting full English dates: ' + e.message);
        }
    }

    // Convert full JavaScript-style English dates (e.g. Sat May 23 2026 00:33:50 GMT+0330)
    function convertFullEnglishDates($) {
        logInfo('=== Converting Full English JS Dates ===');

        var jsDateRegex = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\s+GMT[+-]\d{4})?(?:\s*\([A-Za-z0-9_.\s+-]+\))?/gi;
        var GREGORIAN_MONTH_MAP = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        };
        var PERSIAN_WEEKDAY_MAP = {
            'sat': 'شنبه', 'sun': 'یکشنبه', 'mon': 'دوشنبه', 'tue': 'سه‌شنبه',
            'wed': 'چهارشنبه', 'thu': 'پنج‌شنبه', 'fri': 'جمعه'
        };
        var PERSIAN_MONTH_NAMES = [
            'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
            'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
        ];

        var convertedCount = 0;

        // Efficiently search elements containing "GMT" or a recent year "202"
        $(':contains("202"), :contains("GMT")').each(function () {
            var $el = $(this);

            $el.contents().each(function () {
                if (this.nodeType === 3) { // Text node
                    var text = this.nodeValue;
                    if (text && jsDateRegex.test(text)) {
                        jsDateRegex.lastIndex = 0; // Reset regex
                        var newText = text.replace(jsDateRegex, function (match, dayOfWeek, monthStr, day, year, hour, minute, second) {
                            var gYear = parseInt(year, 10);
                            var gMonth = GREGORIAN_MONTH_MAP[monthStr.toLowerCase()];
                            var gDay = parseInt(day, 10);

                            if (gYear && gMonth && gDay) {
                                var jDate = toJalaali(gYear, gMonth, gDay);
                                var persianDayOfWeek = PERSIAN_WEEKDAY_MAP[dayOfWeek.toLowerCase()] || '';
                                var persianMonthName = PERSIAN_MONTH_NAMES[jDate.jm - 1];

                                var tzSuffix = '';
                                if (match.indexOf('GMT') > -1) {
                                    var gmtMatch = match.match(/GMT[+-]\d{4}/i);
                                    var tzNameMatch = match.match(/\([A-Za-z0-9_.\s+-]+\)/);

                                    var tzPart = '';
                                    if (tzNameMatch) {
                                        var tzName = tzNameMatch[0].replace(/[()]/g, '').trim();
                                        if (tzName === 'Iran Standard Time' || tzName === 'Iran Daylight Time' || tzName.indexOf('Tehran') > -1) {
                                            tzPart = 'به وقت ایران';
                                        } else {
                                            tzPart = tzName;
                                        }
                                    }

                                    if (gmtMatch) {
                                        var gmtStr = gmtMatch[0];
                                        var offset = gmtStr.replace(/GMT/i, '').trim();
                                        if (offset.length === 5) {
                                            offset = offset.substring(0, 3) + ':' + offset.substring(3);
                                        }
                                        tzSuffix = ' (GMT' + offset + (tzPart ? ' - ' + tzPart : '') + ')';
                                    } else {
                                        tzSuffix = tzPart ? ' (' + tzPart + ')' : '';
                                    }
                                }

                                return persianDayOfWeek + ' ' + jDate.jd + ' ' + persianMonthName + ' ' + jDate.jy + ' ساعت ' + hour + ':' + minute + ':' + second + tzSuffix;
                            }
                            return match;
                        });

                        if (newText !== text) {
                            logInfo('Full English Date converted: "' + text.trim() + '" → "' + newText.trim() + '"');
                            this.nodeValue = newText;
                            convertedCount++;
                        }
                    }
                }
            });
        });
        logInfo('Full English Dates converted: ' + convertedCount);
    }

    // Helper to find the closest input in DOM proximity to a button/element
    function findClosestInput($btn) {
        console.log(PC_LOG_PREFIX + ' [findClosestInput] Searching proximity for element:', $btn[0]);
        if ($btn.is('input')) return $btn;

        // Helper to check if an input is text-like
        function isTextLikeInput(el) {
            if (!el || el.tagName !== 'INPUT') return false;
            var type = (el.getAttribute('type') || 'text').toLowerCase();
            return ['text', 'date', 'datetime', 'datetime-local', 'search'].indexOf(type) !== -1;
        }

        // Strategy 1: Class-based trigger name match (highly specific)
        // If button has class "abc-trigger", look for an input with class "abc" or ID "abc" in closest containers
        var classes = $btn.attr('class') || '';
        var match = classes.match(/([a-zA-Z0-9_-]+)-trigger/);
        if (match) {
            var baseName = match[1]; // e.g. "js-start-date" or "js-end-date"
            var $curr = $btn;
            for (var d = 0; d < 5; d++) {
                $curr = $curr.parent();
                if ($curr.length === 0 || $curr.is('body')) break;
                
                var $target = $curr.find('.' + baseName + ', #' + baseName).filter(function() {
                    return isTextLikeInput(this);
                });
                if ($target.length > 0) {
                    console.log(PC_LOG_PREFIX + ' [findClosestInput] Found input by trigger name match (' + baseName + '):', $target[0]);
                    return $target;
                }
            }
        }

        // Strategy 2: Check siblings
        var $siblings = $btn.siblings().filter(function() {
            return isTextLikeInput(this);
        });
        if ($siblings.length > 0) {
            if ($siblings.length === 1) {
                console.log(PC_LOG_PREFIX + ' [findClosestInput] Single text sibling found:', $siblings[0]);
                return $siblings;
            }
            // If multiple, try the immediate previous sibling
            var $prevSib = $btn.prevAll().filter(function() {
                return isTextLikeInput(this);
            }).first();
            if ($prevSib.length > 0) {
                console.log(PC_LOG_PREFIX + ' [findClosestInput] Closest previous sibling found:', $prevSib[0]);
                return $prevSib;
            }
            // Fallback to first visible sibling
            var $visibleSibs = $siblings.filter(':visible');
            if ($visibleSibs.length > 0) {
                console.log(PC_LOG_PREFIX + ' [findClosestInput] First visible sibling found:', $visibleSibs[0]);
                return $visibleSibs.first();
            }
            return $siblings.first();
        }

        // Strategy 3: Ascend DOM tree to find closest container with a text-like input
        var $current = $btn;
        for (var i = 0; i < 5; i++) {
            $current = $current.parent();
            if ($current.length === 0 || $current.is('body') || $current.is('html')) {
                break;
            }
            
            // Find inputs in this container
            var $inputs = $current.find('input').filter(function() {
                return isTextLikeInput(this);
            });
            
            if ($inputs.length > 0) {
                // If there is only one input in this container, return it
                if ($inputs.length === 1) {
                    console.log(PC_LOG_PREFIX + ' [findClosestInput] Single text input found in ancestor at level ' + i + ':', $inputs[0]);
                    return $inputs;
                }
                
                // If there are multiple, look for one that is physically closest to the button.
                // We can find the closest previous input in DOM order.
                var $prevInContainer = $btn.prevAll().filter(function() {
                    return isTextLikeInput(this);
                }).first();
                if ($prevInContainer.length > 0) {
                    console.log(PC_LOG_PREFIX + ' [findClosestInput] Previous input in container found:', $prevInContainer[0]);
                    return $prevInContainer;
                }
                
                // Or look in children of siblings that are before the button
                var foundTarget = null;
                $btn.prevAll().each(function() {
                    var $subInputs = $(this).find('input').filter(function() {
                        return isTextLikeInput(this);
                    });
                    if ($subInputs.length > 0) {
                        foundTarget = $subInputs.last(); // Last one in preceding sibling is closest
                        return false; // break loop
                    }
                });
                if (foundTarget) {
                    console.log(PC_LOG_PREFIX + ' [findClosestInput] Input in preceding sibling container found:', foundTarget[0]);
                    return foundTarget;
                }

                // Fallback to first visible input
                var $visibleInputs = $inputs.filter(':visible');
                if ($visibleInputs.length > 0) {
                    console.log(PC_LOG_PREFIX + ' [findClosestInput] First visible input found in ancestor at level ' + i + ':', $visibleInputs.first()[0]);
                    return $visibleInputs.first();
                }
                console.log(PC_LOG_PREFIX + ' [findClosestInput] First input found in ancestor at level ' + i + ':', $inputs.first()[0]);
                return $inputs.first();
            }
        }

        console.log(PC_LOG_PREFIX + ' [findClosestInput] No text-like input found within 5 levels');
        return $();
    }

    // Initialize Persian calendar for inline edit mode (intercept Jira's calendar buttons)
    function initInlineEditCalendar($) {
        logInfo('=== Initializing Inline Edit Calendar ===');

        // Selectors for Jira's calendar trigger buttons in inline edit
        var calendarButtonSelectors = [
            '.aui-iconfont-calendar',
            '.icon-calendar',
            '.calendar-icon',
            '[class*="calendar-trigger"]',
            'button[class*="calendar"]',
            'span[class*="calendar"]',
            // JSM Customer Portal specific selectors (from DOM inspection)
            '.sd-calendar-icon',
            '.trigger-show-date-picker',
            '.show-date-picker',
            'button[id*="trigger-"]',
            '.sd-date-picker-gr',
            '[class*="date-picker"]',
            // Tempo plugin Log Time Date field
            'input#started'
        ];

        // Remove old listener if exists
        if (window.pcCalendarCaptureListener) {
            document.removeEventListener('click', window.pcCalendarCaptureListener, true);
        }

        // Use CAPTURE phase (third param = true) to intercept BEFORE Jira's handlers
        window.pcCalendarCaptureListener = function (e) {
            var target = e.target;
            var $target = $(target);

            console.log(PC_LOG_PREFIX + ' [CAPTURE-PHASE] Click detected on tag:', target.tagName, 'classes:', $target.attr('class'), 'id:', $target.attr('id'));

            // Check if clicked on calendar icon or its parent
            var isCalendarButton = false;
            var $btn = null;

            // Check target and parents for calendar-related classes
            for (var i = 0; i < calendarButtonSelectors.length; i++) {
                if ($target.is(calendarButtonSelectors[i])) {
                    isCalendarButton = true;
                    $btn = $target;
                    break;
                }
                var $parent = $target.closest(calendarButtonSelectors[i]);
                if ($parent.length > 0) {
                    isCalendarButton = true;
                    $btn = $parent;
                    break;
                }
            }

            if (!isCalendarButton) return;

            console.log(PC_LOG_PREFIX + ' [CAPTURE-PHASE] Click recognized as calendar button! Button:', $btn[0]);

            // Check if inside datesmodule (Jira Core inline edit) OR JSM Customer Portal date picker
            var $datesModule = $btn.closest('#datesmodule');
            var $jsmDatePicker = $btn.closest('.cv-request-create-container, .sd-date-picker, .cp-date-picker, .field-group, [class*="date-picker"], form');

            // Allow either Jira Core (datesmodule) or JSM (various containers)
            var isJiraCore = $datesModule.length > 0;
            var isJSM = $jsmDatePicker.length > 0;

            console.log(PC_LOG_PREFIX + ' [CAPTURE-PHASE] Context detected: Jira Core=' + isJiraCore + ', JSM=' + isJSM);

            // Find the associated input field using a smart proximity search
            var $input = findClosestInput($btn);

            if ($input.length === 0) {
                logDebug('No input found for calendar button');
                return;
            }

            logInfo('Found input: id=' + $input.attr('id') + ', name=' + $input.attr('name') + ', value=' + $input.val());

            logInfo('Intercepting calendar button click (capture phase)');

            // STOP propagation completely - this prevents Jira from handling it
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Also disable Jira's datepicker on this input
            try {
                if ($input.data('aui-datepicker')) {
                    $input.data('aui-datepicker').hide();
                }
            } catch (ex) { }

            // Detect if this is a DateTime field
            var inputValue = $input.val() || '';
            var placeholder = $input.attr('placeholder') || '';
            var inputClass = $input.attr('class') || '';
            var dataFormat = $input.attr('data-iformat') || $input.attr('data-format') || '';
            var dataShowTime = $input.attr('data-showtime') || '';
            var timeFormat = $input.attr('timeformat') || '';

            // Check multiple ways to detect DateTime
            var isDateTime =
                inputValue.match(/\d{1,2}:\d{2}/) ||
                inputValue.match(/[AP]M/i) ||
                placeholder.match(/h:mm/i) ||
                placeholder.match(/time/i) ||
                ($input.closest('[data-type]').length > 0 && $input.closest('[data-type]').attr('data-type') === 'datetime') ||
                ($input.attr('data-type') === 'datetime') ||
                // JSM specific checks
                inputClass.indexOf('datetime') !== -1 ||
                inputClass.indexOf('time') !== -1 ||
                dataFormat.indexOf('h') !== -1 ||
                dataFormat.indexOf('H') !== -1 ||
                dataFormat.indexOf(':') !== -1 ||
                dataShowTime === 'true' ||
                timeFormat.length > 0;

            logInfo('DateTime detection: isDateTime=' + !!isDateTime + ', value="' + inputValue + '", class="' + inputClass + '", dataFormat="' + dataFormat + '"');

            // Show our Persian calendar (with license check)
            setTimeout(function () {
                checkLicenseStatus(function (license) {
                    if (!license.enabled) {
                        showLicenseExpiredMessage();
                        return;
                    }
                    if (isDateTime) {
                        showPersianDateTimePickerForInlineEdit($, $btn, $input);
                    } else {
                        showPersianCalendarForInlineEdit($, $btn, $input);
                    }
                });
            }, 0);
        };

        // Add listener with CAPTURE phase
        document.addEventListener('click', window.pcCalendarCaptureListener, true);

        logInfo('Inline edit calendar initialized (with capture phase)');
    }

    // Show Persian calendar popup for inline edit (Date only)
    function showPersianCalendarForInlineEdit($, $btn, $input) {
        logInfo('Opening Persian calendar for inline edit');

        var $existing = $('.pc-popup');
        if ($existing.length) $existing.remove();
        var $overlay = $('.pc-overlay');
        if ($overlay.length) $overlay.remove();

        var today = new Date();
        var todayJ = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());

        // Get current value from input
        var currentJDate = null;
        var currentVal = $input.val();
        if (currentVal) {
            var gDate = parseJiraDate(currentVal.split(/\s+\d{1,2}:/)[0]); // Remove time part
            if (gDate) {
                currentJDate = toJalaali(gDate.year, gDate.month, gDate.day);
                logDebug('Current inline edit date in Jalaali', currentJDate);
            }
        }

        var selectedDate = currentJDate ? { jy: currentJDate.jy, jm: currentJDate.jm, jd: currentJDate.jd } : null;
        var viewYear = selectedDate ? selectedDate.jy : todayJ.jy;
        var viewMonth = selectedDate ? selectedDate.jm : todayJ.jm;

        // *** CRITICAL: Prevent Jira from closing inline edit when we click on our popup ***
        // Store the editable field container
        var $editableField = $input.closest('.editable-field');
        var $inlineEditFields = $input.closest('.inline-edit-fields');

        // Mark that our popup is active - this helps prevent blur handlers
        window.pcPopupActive = true;

        // Prevent blur events on the input while our popup is visible
        var preventBlur = function (e) {
            if (window.pcPopupActive) {
                logInfo('Preventing blur event while popup is active');
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
        };

        // Prevent focusout which Jira uses to detect when to close inline edit
        var preventFocusOut = function (e) {
            if (window.pcPopupActive) {
                logInfo('Preventing focusout event while popup is active');
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
        };

        // Add event listeners to capture and prevent blur/focusout
        $input[0].addEventListener('blur', preventBlur, true);
        $input[0].addEventListener('focusout', preventFocusOut, true);
        if ($editableField.length) {
            $editableField[0].addEventListener('focusout', preventFocusOut, true);
        }

        // Store cleanup functions
        var cleanupBlurPrevention = function () {
            window.pcPopupActive = false;
            try {
                $input[0].removeEventListener('blur', preventBlur, true);
                $input[0].removeEventListener('focusout', preventFocusOut, true);
                if ($editableField.length) {
                    $editableField[0].removeEventListener('focusout', preventFocusOut, true);
                }
            } catch (e) { }
        };

        // Create overlay - clicking it will close the popup but keep inline edit open
        var overlay = $('<div class="pc-overlay"></div>').appendTo('body');
        var openTime = Date.now();

        // Create popup
        var popup = $('<div class="pc-popup react-datepicker-ignore-onclickoutside"></div>').appendTo('body');

        // Prevent mousedown on popup from causing blur
        popup.on('mousedown', function (e) {
            e.preventDefault();
            logInfo('Mousedown on popup - preventing default');
        });

        overlay.on('mousedown', function (e) {
            e.preventDefault();
        });

        // Position popup near the button
        var rect = $btn[0].getBoundingClientRect();
        var popupHeight = 380;
        var popupWidth = 320;
        var viewportHeight = window.innerHeight;
        var viewportWidth = window.innerWidth;

        var spaceBelow = viewportHeight - rect.bottom;
        var topPos = spaceBelow >= popupHeight ? rect.bottom + window.scrollY + 5 : rect.top + window.scrollY - popupHeight - 5;
        var leftPos = Math.min(rect.left + window.scrollX, viewportWidth - popupWidth - 10);
        if (leftPos < 10) leftPos = 10;

        popup.css({
            position: 'absolute',
            top: topPos + 'px',
            left: leftPos + 'px',
            zIndex: 2000000001
        });

        function render() {
            // DateTime: RTL arrows requested by user
            // Visual order RIGHT to LEFT: >> > | Title | < <<
            var html = '<div class="pc-header">';
            html += '<button type="button" class="pc-next-year" title="سال بعد">سال بعد</button>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">ماه بعد</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">ماه قبل</button>';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">سال قبل</button>';
            html += '</div>';

            html += '<div class="pc-weekdays">';
            for (var w = 0; w < 7; w++) {
                html += '<span>' + PERSIAN_WEEKDAYS[w] + '</span>';
            }
            html += '</div>';

            html += '<div class="pc-days">';

            var gFirst = toGregorian(viewYear, viewMonth, 1);
            var firstDate = new Date(gFirst.gy, gFirst.gm - 1, gFirst.gd);
            var firstDayOfWeek = firstDate.getDay();
            var persianFirstDay = (firstDayOfWeek + 1) % 7;
            var daysInMonth = jalaaliMonthLength(viewYear, viewMonth);

            for (var e = 0; e < persianFirstDay; e++) {
                html += '<span class="pc-day empty"></span>';
            }

            for (var d = 1; d <= daysInMonth; d++) {
                var isSelected = selectedDate && (d === selectedDate.jd && viewMonth === selectedDate.jm && viewYear === selectedDate.jy);
                var isToday = (d === todayJ.jd && viewMonth === todayJ.jm && viewYear === todayJ.jy);

                // Highlight Fridays and Holidays with Occasions
                var weekdayIdx = (persianFirstDay + d - 1) % 7;
                var holidayKey = viewYear + '-' + viewMonth + '-' + d;
                var isFriday = (weekdayIdx === 6);
                var holidayOccasion = IRAN_HOLIDAYS[holidayKey];

                var classes = 'pc-day' + (isSelected ? ' selected' : '') + (isToday ? ' today' : '');

                var titleAttr = '';
                if (holidayOccasion) {
                    classes += ' holiday';
                    titleAttr = ' title="' + holidayOccasion + '"';
                } else if (isFriday) {
                    classes += ' friday';
                    titleAttr = ' title="جمعه"';
                }

                html += '<span class="' + classes + '" data-day="' + d + '"' + titleAttr + '>' + d + '</span>';
            }
            html += '</div>';
            
            html += '<div class="pc-footer">';
            html += '<button type="button" class="pc-confirm">تأیید</button>';
            html += '<button type="button" class="pc-today">امروز</button>';
            html += '<button type="button" class="pc-clear">پاک کردن</button>';
            html += '</div>';


            popup.html(html);
        }

        function close() {
            document.body.classList.remove('pc-calendar-is-open');
            // Cleanup blur prevention before closing
            cleanupBlurPrevention();
            popup.remove();
            overlay.remove();
        }

        function selectDay(day) {
            selectedDate = { jy: viewYear, jm: viewMonth, jd: day };
            render();
        }

        function confirm() {
            logInfo('=== CONFIRM CALLED ===');
            logInfo('selectedDate: ' + JSON.stringify(selectedDate));

            if (selectedDate) {
                var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                logInfo('Converting Shamsi to Gregorian: ' + selectedDate.jy + '/' + selectedDate.jm + '/' + selectedDate.jd + ' -> ' + gDate.gy + '/' + gDate.gm + '/' + gDate.gd);
                // Detect the existing input's year format (2-digit vs 4-digit) and match it
                var existingVal = $input ? $input.val() : '';
                var use2DigitYear = existingVal && /\/\d{2}$/.test(existingVal.trim());
                var gregorianStr;
                if (use2DigitYear) {
                    // Match 2-digit year format e.g. "4/Jun/26"
                    var yy = String(gDate.gy).slice(-2);
                    var mm = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][gDate.gm - 1];
                    gregorianStr = gDate.gd + '/' + mm + '/' + yy;
                } else {
                    gregorianStr = formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                }
                logInfo('Formatted Gregorian string: ' + gregorianStr + ' (use2DigitYear=' + use2DigitYear + ')');

                // Re-find the input field using smart proximity and fallback
                var $activeInput = null;
                if ($input && $input.length > 0 && document.body.contains($input[0]) && $input.is(':visible')) {
                    $activeInput = $input;
                    logInfo('Using original input (still in DOM and visible)');
                } else {
                    var originalId = $input ? $input.attr('id') : null;
                    if (originalId) {
                        $activeInput = $('#' + originalId + ':visible').first();
                        logInfo('Re-found input by ID: ' + originalId + ', found: ' + ($activeInput.length > 0));
                    }
                    if ((!$activeInput || $activeInput.length === 0) && $input) {
                        var originalName = $input.attr('name');
                        if (originalName) {
                            $activeInput = $('input[name="' + originalName + '"]:visible').first();
                            logInfo('Re-found input by Name: ' + originalName + ', found: ' + ($activeInput.length > 0));
                        }
                    }
                    if (!$activeInput || $activeInput.length === 0) {
                        $activeInput = $input;
                        logInfo('Fallback to original input');
                    }
                }

                if (!$activeInput || $activeInput.length === 0) {
                    logError('NO INPUT FOUND! Cannot set value.');
                    close();
                    return;
                }

                logInfo('Found active input: id=' + $activeInput.attr('id') + ', name=' + $activeInput.attr('name') + ', class=' + $activeInput.attr('class'));
                logInfo('Current input value before change: ' + $activeInput.val());

                // Set value using multiple methods to ensure it works
                setInputAndTriggerEvents($activeInput, gregorianStr);

                logInfo('Input value after setting: ' + $activeInput.val());

                // Find and click Jira's inline edit submit button (the checkmark icon)
                var $form = $activeInput.closest('form');
                var $editableField = $activeInput.closest('.editable-field');

                // Look for the submit/save button - Jira uses various patterns
                var $submitBtn = null;

                // Try to find submit button in form first
                if ($form.length > 0) {
                    $submitBtn = $form.find('button[type="submit"], input[type="submit"], .aui-button.submit, button.submit').first();
                }

                // Try editable field container
                if ((!$submitBtn || $submitBtn.length === 0) && $editableField.length > 0) {
                    $submitBtn = $editableField.find('button[type="submit"], .aui-button.submit, .inline-edit-save, .save').first();
                }

                // Try the icons container (Jira often uses icon buttons)
                if (!$submitBtn || $submitBtn.length === 0) {
                    var $datesModuleNode2 = $activeInput.closest('#datesmodule');
                    if ($datesModuleNode2.length > 0) {
                        $submitBtn = $datesModuleNode2.find('.inline-edit-fields button[type="submit"], .aui-icon-check, [class*="save"]').first();
                    }
                }

                if ($submitBtn && $submitBtn.length > 0) {
                    logInfo('Found submit button: ' + $submitBtn.attr('class') + ', clicking to save');
                    setTimeout(function () {
                        $submitBtn.click();
                        $submitBtn.trigger('click');
                    }, 50);
                } else {
                    // Trigger Enter key as fallback - this often submits inline edit forms
                    logInfo('No submit button found, triggering Enter key on input');
                    setTimeout(function () {
                        // Focus the input first
                        $activeInput[0].focus();

                        // Simulate pressing Enter
                        var enterEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        $activeInput[0].dispatchEvent(enterEvent);

                        var enterUp = new KeyboardEvent('keyup', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true
                        });
                        $activeInput[0].dispatchEvent(enterUp);

                        // Also trigger blur which sometimes triggers save
                        setTimeout(function () {
                            $activeInput.trigger('blur');
                            $activeInput[0].blur();
                        }, 50);
                    }, 50);
                }
            }
            close();
        }

        popup.on('click', function (e) {
            var target = $(e.target);
            if (target.hasClass('pc-prev-year')) { viewYear--; render(); }
            else if (target.hasClass('pc-next-year')) { viewYear++; render(); }
            else if (target.hasClass('pc-prev-month')) { viewMonth--; if (viewMonth < 1) { viewMonth = 12; viewYear--; } render(); }
            else if (target.hasClass('pc-next-month')) { viewMonth++; if (viewMonth > 12) { viewMonth = 1; viewYear++; } render(); }
            else if (target.hasClass('pc-day') && !target.hasClass('empty')) { selectDay(parseInt(target.data('day'), 10)); confirm(); }
            else if (target.hasClass('pc-today')) { selectedDate = { jy: todayJ.jy, jm: todayJ.jm, jd: todayJ.jd }; confirm(); }
            else if (target.hasClass('pc-clear')) { setInputAndTriggerEvents($input, ''); close(); }
            else if (target.hasClass('pc-confirm')) { confirm(); }
            e.preventDefault();
            e.stopPropagation();
        });

        popup.on('mousedown mouseup pointerdown pointerup', function(e) {
            e.stopPropagation();
        });

        overlay.on('mousedown mouseup pointerdown pointerup', function(e) {
            e.stopPropagation();
        });

        overlay.on('click', function (e) {
            e.stopPropagation();
            if (Date.now() - openTime < 300) {
                logDebug('Ignoring overlay click too close to open time');
                return;
            }
            close();
        });
        render();
    }

    // Show Persian DateTime picker popup for inline edit (Date + Time)
    function showPersianDateTimePickerForInlineEdit($, $btn, $input) {
        logInfo('Opening Persian DateTime picker for inline edit');

        var $existing = $('.pc-popup');
        if ($existing.length) $existing.remove();
        var $overlay = $('.pc-overlay');
        if ($overlay.length) $overlay.remove();

        var today = new Date();
        var todayJ = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());

        // Get current value from input
        var currentJDate = null;
        var currentHour = 12, currentMinute = 0, currentAmPm = 'PM';
        var currentVal = $input.val();

        if (currentVal) {
            var datePart = currentVal.split(/\s+\d{1,2}:/)[0];
            var gDate = parseJiraDate(datePart);
            if (gDate) {
                currentJDate = toJalaali(gDate.year, gDate.month, gDate.day);
            }

            // Extract time
            var timeMatch = currentVal.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (timeMatch) {
                currentHour = parseInt(timeMatch[1], 10);
                currentMinute = parseInt(timeMatch[2], 10);
                currentAmPm = timeMatch[3] ? timeMatch[3].toUpperCase() : (currentHour >= 12 ? 'PM' : 'AM');
            }
        }

        var selectedDate = currentJDate ? { jy: currentJDate.jy, jm: currentJDate.jm, jd: currentJDate.jd } : null;
        var viewYear = selectedDate ? selectedDate.jy : todayJ.jy;
        var viewMonth = selectedDate ? selectedDate.jm : todayJ.jm;
        var selectedHour = currentHour;
        var selectedMinute = currentMinute;
        var selectedAmPm = currentAmPm;

        // *** CRITICAL: Prevent Jira from closing inline edit when we click on our popup ***
        // Store the editable field container
        var $editableField = $input.closest('.editable-field');
        var $inlineEditFields = $input.closest('.inline-edit-fields');

        // Mark that our popup is active - this helps prevent blur handlers
        window.pcPopupActive = true;

        // Prevent blur events on the input while our popup is visible
        var preventBlur = function (e) {
            if (window.pcPopupActive) {
                logInfo('Preventing blur event while DateTime popup is active');
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
        };

        // Prevent focusout which Jira uses to detect when to close inline edit
        var preventFocusOut = function (e) {
            if (window.pcPopupActive) {
                logInfo('Preventing focusout event while DateTime popup is active');
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
        };

        // Add event listeners to capture and prevent blur/focusout
        $input[0].addEventListener('blur', preventBlur, true);
        $input[0].addEventListener('focusout', preventFocusOut, true);
        if ($editableField.length) {
            $editableField[0].addEventListener('focusout', preventFocusOut, true);
        }

        // Store cleanup functions
        var cleanupBlurPrevention = function () {
            window.pcPopupActive = false;
            try {
                $input[0].removeEventListener('blur', preventBlur, true);
                $input[0].removeEventListener('focusout', preventFocusOut, true);
                if ($editableField.length) {
                    $editableField[0].removeEventListener('focusout', preventFocusOut, true);
                }
            } catch (e) { }
        };

        // Create overlay
        var overlay = $('<div class="pc-overlay"></div>').appendTo('body');
        var openTime = Date.now();
        var popup = $('<div class="pc-popup react-datepicker-ignore-onclickoutside"></div>').appendTo('body');

        // Prevent mousedown on popup from causing blur
        popup.on('mousedown', function (e) {
            e.preventDefault();
            logInfo('Mousedown on DateTime popup - preventing default');
        });

        overlay.on('mousedown', function (e) {
            e.preventDefault();
        });

        // Position popup
        var rect = $btn[0].getBoundingClientRect();
        var popupHeight = 480;
        var viewportHeight = window.innerHeight;
        var viewportWidth = window.innerWidth;

        var spaceBelow = viewportHeight - rect.bottom;
        var topPos = spaceBelow >= popupHeight ? rect.bottom + window.scrollY + 5 : rect.top + window.scrollY - popupHeight - 5;
        var leftPos = Math.min(rect.left + window.scrollX, viewportWidth - 320 - 10);
        if (leftPos < 10) leftPos = 10;

        popup.css({ position: 'absolute', top: topPos + 'px', left: leftPos + 'px', zIndex: 2000000001 });

        function render() {
            var html = '<div class="pc-header" style="justify-content:space-between; align-items:center;">';
            html += '<button type="button" class="pc-next-year" title="سال بعد">سال بعد</button>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">ماه بعد</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">ماه قبل</button>';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">سال قبل</button>';
            html += '</div>';

            html += '<div class="pc-weekdays">';
            for (var w = 0; w < 7; w++) { html += '<span>' + PERSIAN_WEEKDAYS[w] + '</span>'; }
            html += '</div>';

            html += '<div class="pc-days">';
            var gFirst = toGregorian(viewYear, viewMonth, 1);
            var firstDate = new Date(gFirst.gy, gFirst.gm - 1, gFirst.gd);
            var persianFirstDay = (firstDate.getDay() + 1) % 7;
            var daysInMonth = jalaaliMonthLength(viewYear, viewMonth);

            for (var e = 0; e < persianFirstDay; e++) { html += '<span class="pc-day empty"></span>'; }
            for (var d = 1; d <= daysInMonth; d++) {
                var isSelected = selectedDate && (d === selectedDate.jd && viewMonth === selectedDate.jm && viewYear === selectedDate.jy);
                var isToday = (d === todayJ.jd && viewMonth === todayJ.jm && viewYear === todayJ.jy);

                // Highlight Fridays and Holidays with Occasions
                var weekdayIdx = (persianFirstDay + d - 1) % 7;
                var holidayKey = viewYear + '-' + viewMonth + '-' + d;
                var isFriday = (weekdayIdx === 6);
                var holidayOccasion = IRAN_HOLIDAYS[holidayKey];

                var classes = 'pc-day' + (isSelected ? ' selected' : '') + (isToday ? ' today' : '');

                var titleAttr = '';
                if (holidayOccasion) {
                    classes += ' holiday';
                    titleAttr = ' title="' + holidayOccasion + '"';
                } else if (isFriday) {
                    classes += ' friday';
                    titleAttr = ' title="جمعه"';
                }

                html += '<span class="' + classes + '" data-day="' + d + '"' + titleAttr + '>' + d + '</span>';
            }
            html += '</div>';

            // Time picker
            html += '<div class="pc-time-picker">';
            html += '<label>ساعت:</label>';
            html += '<select class="pc-hour">';
            for (var h = 1; h <= 12; h++) {
                var sel = (h === selectedHour || (selectedHour === 0 && h === 12)) ? ' selected' : '';
                html += '<option value="' + h + '"' + sel + '>' + (h < 10 ? '0' + h : h) + '</option>';
            }
            html += '</select>';
            html += '<span>:</span>';
            html += '<select class="pc-minute">';
            for (var m = 0; m < 60; m += 5) {
                var sel = (m === selectedMinute || (selectedMinute < 5 && m === 0)) ? ' selected' : '';
                html += '<option value="' + m + '"' + sel + '>' + (m < 10 ? '0' + m : m) + '</option>';
            }
            html += '</select>';
            html += '<select class="pc-ampm">';
            html += '<option value="AM"' + (selectedAmPm === 'AM' ? ' selected' : '') + '>AM</option>';
            html += '<option value="PM"' + (selectedAmPm === 'PM' ? ' selected' : '') + '>PM</option>';
            html += '</select>';
            html += '</div>';

            html += '<div class="pc-footer">';
            html += '<button type="button" class="pc-confirm">تأیید</button>';
            html += '<button type="button" class="pc-today">الان</button>';
            html += '<button type="button" class="pc-clear">پاک کردن</button>';
            html += '</div>';

            popup.html(html);

            // Bind time selectors
            popup.find('.pc-hour').on('change', function () { selectedHour = parseInt($(this).val(), 10); });
            popup.find('.pc-minute').on('change', function () { selectedMinute = parseInt($(this).val(), 10); });
            popup.find('.pc-ampm').on('change', function () { selectedAmPm = $(this).val(); });
        }

        function close() {
            document.body.classList.remove('pc-calendar-is-open'); cleanupBlurPrevention(); popup.remove(); overlay.remove(); }

        function selectDay(day) { selectedDate = { jy: viewYear, jm: viewMonth, jd: day }; render(); }

        function confirm() {
            if (selectedDate) {
                var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                logInfo('Converting Shamsi to Gregorian: ' + selectedDate.jy + '/' + selectedDate.jm + '/' + selectedDate.jd + ' -> ' + gDate.gy + '/' + gDate.gm + '/' + gDate.gd);
                var gregorianStr = formatJiraDateTime(gDate.gy, gDate.gm, gDate.gd, selectedHour, selectedMinute, selectedAmPm);
                logInfo('Setting inline edit DateTime value (Gregorian): ' + gregorianStr);

                // Re-find the input field using smart proximity and fallback
                var $activeInput = null;
                if ($input && $input.length > 0 && document.body.contains($input[0]) && $input.is(':visible')) {
                    $activeInput = $input;
                    logInfo('Using original input for DateTime (still in DOM and visible)');
                } else {
                    var originalId = $input ? $input.attr('id') : null;
                    if (originalId) {
                        $activeInput = $('#' + originalId + ':visible').first();
                        logInfo('Re-found DateTime input by ID: ' + originalId + ', found: ' + ($activeInput.length > 0));
                    }
                    if ((!$activeInput || $activeInput.length === 0) && $input) {
                        var originalName = $input.attr('name');
                        if (originalName) {
                            $activeInput = $('input[name="' + originalName + '"]:visible').first();
                            logInfo('Re-found DateTime input by Name: ' + originalName + ', found: ' + ($activeInput.length > 0));
                        }
                    }
                    if (!$activeInput || $activeInput.length === 0) {
                        $activeInput = $input;
                        logInfo('Fallback to original DateTime input');
                    }
                }

                logInfo('Found active input for DateTime: ' + $activeInput.attr('id') + ' / ' + $activeInput.attr('class'));

                // Set value using multiple methods
                setInputAndTriggerEvents($activeInput, gregorianStr);

                logInfo('DateTime value set: ' + $activeInput.val());

                // Find submit button
                var $form = $activeInput.closest('form');
                var $editableField = $activeInput.closest('.editable-field');
                var $submitBtn = null;

                if ($form.length > 0) {
                    $submitBtn = $form.find('button[type="submit"], input[type="submit"], .aui-button.submit').first();
                }

                if ((!$submitBtn || $submitBtn.length === 0) && $editableField.length > 0) {
                    $submitBtn = $editableField.find('button[type="submit"], .aui-button.submit, .inline-edit-save').first();
                }

                if (!$submitBtn || $submitBtn.length === 0) {
                    $submitBtn = $datesModule.find('.inline-edit-fields button[type="submit"], .aui-icon-check, [class*="save"]').first();
                }

                if ($submitBtn && $submitBtn.length > 0) {
                    logInfo('Found submit button for DateTime, clicking');
                    setTimeout(function () {
                        $submitBtn.click();
                        $submitBtn.trigger('click');
                    }, 50);
                } else {
                    logInfo('No submit button found for DateTime, triggering Enter');
                    setTimeout(function () {
                        $activeInput[0].focus();
                        var enterEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        $activeInput[0].dispatchEvent(enterEvent);

                        setTimeout(function () {
                            $activeInput.trigger('blur');
                            $activeInput[0].blur();
                        }, 50);
                    }, 50);
                }
            }
            close();
        }

        popup.on('click', function (e) {
            var target = $(e.target);
            if (target.hasClass('pc-prev-year')) { viewYear--; render(); }
            else if (target.hasClass('pc-next-year')) { viewYear++; render(); }
            else if (target.hasClass('pc-prev-month')) { viewMonth--; if (viewMonth < 1) { viewMonth = 12; viewYear--; } render(); }
            else if (target.hasClass('pc-next-month')) { viewMonth++; if (viewMonth > 12) { viewMonth = 1; viewYear++; } render(); }
            else if (target.hasClass('pc-day') && !target.hasClass('empty')) { selectDay(parseInt(target.data('day'), 10)); }
            else if (target.hasClass('pc-today')) {
                selectedDate = { jy: todayJ.jy, jm: todayJ.jm, jd: todayJ.jd };
                var now = new Date();
                selectedHour = now.getHours() % 12 || 12;
                selectedMinute = Math.floor(now.getMinutes() / 5) * 5;
                selectedAmPm = now.getHours() >= 12 ? 'PM' : 'AM';
                confirm();
            }
            else if (target.hasClass('pc-clear')) { setInputAndTriggerEvents($input, ''); close(); }
            else if (target.hasClass('pc-confirm')) { confirm(); }
            e.preventDefault();
            e.stopPropagation();
        });

        popup.on('mousedown mouseup pointerdown pointerup', function(e) {
            e.stopPropagation();
        });

        overlay.on('mousedown mouseup pointerdown pointerup', function(e) {
            e.stopPropagation();
        });

        overlay.on('click', function (e) {
            e.stopPropagation();
            if (Date.now() - openTime < 300) {
                logDebug('Ignoring overlay click too close to open time');
                return;
            }
            close();
        });
        render();
    }

    // Helper to safely trigger React native events and jQuery events on inputs (Jira 10+ compatibility)
    function setInputAndTriggerEvents($input, valueStr) {
        var inputEl = $input[0];
        try {
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
            nativeInputValueSetter.call(inputEl, valueStr);
        } catch (ex) {
            inputEl.value = valueStr;
        }
        $input.attr('value', valueStr);

        try { inputEl.dispatchEvent(new Event('input', { bubbles: true })); } catch(e) {}
        try { inputEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}

        // Also try to find React props and invoke onChange directly if tracker approach failed
        try {
            var reactPropsKey = Object.keys(inputEl).find(key => key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$'));
            if (reactPropsKey && inputEl[reactPropsKey] && inputEl[reactPropsKey].onChange) {
                var syntheticEvent = { target: inputEl, currentTarget: inputEl, type: 'change' };
                inputEl[reactPropsKey].onChange(syntheticEvent);
                console.log(PC_LOG_PREFIX + ' [INFO] Invoked React onChange directly on ' + inputEl.id);
            }
        } catch(e) {}

        try { 
            var ev = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
            inputEl.dispatchEvent(ev);
        } catch(e) {}
        try { inputEl.dispatchEvent(new Event('blur', { bubbles: true })); } catch(e) {}
        
        try { $input.trigger('input').trigger('change').trigger('blur'); } catch (e) {}
    }

    // Initialize Persian calendar for date inputs
    function initPersianCalendar($) {
        logInfo('=== Initializing Persian Calendar ===');
        addStyles();

        // Find all date-type inputs (Create/Edit screens only)
        // These are for Create/Edit dialogs - Date-only fields (not DateTime)
        var selectors = [
            // Specific date fields in Create/Edit forms
            'input#duedate',
            'input[name="duedate"]',
            // Custom date fields in edit dialogs (like Plan Date, Time of Start)
            '.field-group input.datepicker-input',
            '.field-group input.aui-date-picker',
            // Log Work dialog DateTime fields (Date Started)
            'input#log-work-form-date-logged-date-picker',
            'input#log-work-date-logged-date-picker',
            'input[name="startDate"]',
            'input[name="worklog_startDate"]'
        ];

        // Search page selectors - ONLY the Between date inputs
        // These are the inputs with specific IDs that show actual date pickers
        var searchSelectors = [
            // Between dates (the main ones with calendar icon)
            'input#dateBetweenStart',
            'input#dateBetweenEnd'
        ];

        var allSelectors = selectors.concat(searchSelectors);
        logDebug('Searching with selectors', allSelectors);

        var foundCount = 0;
        $(allSelectors.join(',')).each(function () {
            var $original = $(this);

            // Skip non-text inputs (radio, checkbox, hidden, etc.)
            var inputType = $original.attr('type') || 'text';
            if (inputType !== 'text') {
                logDebug('Skipping non-text input type: ' + inputType);
                return;
            }

            // Skip if already has Persian button next to it
            if ($original.next('.pc-search-btn').length > 0 || $original.prev('.pc-search-btn').length > 0) {
                logDebug('Skipping - already has Persian button');
                return;
            }

            // Skip inputs inside inline edit containers on the view page
            // These should use Jira's native date picker, not our Persian calendar
            if ($original.closest('.inline-edit-fields').length > 0 ||
                $original.closest('.inline-edit-fields-container').length > 0 ||
                $original.closest('.editable-field').length > 0 ||
                $original.closest('.aui-inline-dialog').length > 0 ||
                $original.closest('#datesmodule').length > 0 ||
                $original.closest('#details-module').length > 0 ||
                $original.closest('.issue-view').length > 0 ||
                $original.closest('[data-type="date"]').length > 0 ||
                $original.closest('.ajs-layer').length > 0) {
                logDebug('Skipping input inside inline edit container: ' + $original.attr('id'));
                return;
            }

            // Skip hidden inputs
            if ($original.is(':hidden') && !$original.closest('.aui-dialog2-content, .jira-dialog-content, form').length) {
                logDebug('Skipping hidden input outside dialog');
                return;
            }

            // Detect DateTime fields (Date + Time picker)
            // Check multiple sources: value, placeholder, description text, data attributes
            var currentValue = $original.val() || '';
            var placeholder = $original.attr('placeholder') || '';

            // Check if the field has time in its value
            var hasTimeInValue = currentValue.match(/\d{1,2}:\d{2}/) || currentValue.match(/[AP]M/i);

            // Check placeholder for time hints
            var hasTimeInPlaceholder = placeholder.match(/\d{1,2}:\d{2}/) || placeholder.match(/h:mm/i);

            // Check description text in sibling elements (e.g., "Use the dd/MMM/yy h:mm a date format")
            var $fieldGroup = $original.closest('.field-group');
            var descriptionText = $fieldGroup.find('.description, .field-desc, .aui-field-description').text() || '';
            var hasTimeInDescription = descriptionText.match(/h:mm/i) || descriptionText.match(/time/i) || descriptionText.match(/\d{1,2}:\d{2}/);

            // Check specific known DateTime field IDs/names
            var id = $original.attr('id') || '';
            var name = $original.attr('name') || '';

            var isKnownDateTimeField =
                id === 'log-work-form-date-logged-date-picker' ||
                id === 'log-work-date-logged-date-picker' ||
                id.indexOf('created') !== -1 ||
                id.indexOf('updated') !== -1 ||
                id.indexOf('resolved') !== -1 ||
                id.indexOf('resolutiondate') !== -1 ||
                name === 'startDate' ||
                name === 'worklog_startDate' ||
                name.indexOf('created') !== -1 ||
                name.indexOf('updated') !== -1;

            // Combine all checks
            var isDateTimeField = hasTimeInValue || hasTimeInPlaceholder || hasTimeInDescription || isKnownDateTimeField;

            // Log detection details for debugging
            logDebug('DateTime detection', {
                id: $original.attr('id'),
                hasTimeInValue: !!hasTimeInValue,
                hasTimeInPlaceholder: !!hasTimeInPlaceholder,
                hasTimeInDescription: !!hasTimeInDescription,
                descriptionText: descriptionText.substring(0, 100),
                isDateTimeField: isDateTimeField
            });

            logDebug('Found matching input', {
                id: $original.attr('id'),
                name: $original.attr('name'),
                class: $original.attr('class'),
                alreadyInit: $original.data('pc-init') ? true : false
            });

            if ($original.data('pc-init')) {
                logDebug('Input already initialized, skipping');
                return;
            }

            foundCount++;
            $original.data('pc-init', true);

            // Check if this is a Search page input (Between dates only)
            var isSearchInput = $original.attr('id') === 'dateBetweenStart' ||
                $original.attr('id') === 'dateBetweenEnd';

            logDebug('Is Search input: ' + isSearchInput);

            if (isSearchInput) {
                // SEARCH PAGE: Add a button beside the input
                logInfo('Processing Search page date input');

                // Create Persian date display span
                var $persianDisplay = $('<span class="pc-persian-display" style="margin-right:5px; color:#0052cc; font-weight:bold; font-size:12px; direction:rtl;"></span>');

                // Create Persian calendar button
                var $btn = $('<button type="button" class="aui-button pc-search-btn" style="margin-right:5px; background:#0052cc; color:#fff; padding:2px 8px; font-size:11px; border-radius:3px;">📅 شمسی</button>');
                $original.after($btn);
                $btn.after($persianDisplay);
                logInfo('Added Persian calendar button to Search input');

                // If input already has a value, show Persian equivalent
                var existingVal = $original.val();
                if (existingVal) {
                    var parsedDate = parseJiraDate(existingVal);
                    if (parsedDate) {
                        var jDate = toJalaali(parsedDate.year, parsedDate.month, parsedDate.day);
                        $persianDisplay.text(formatPersianDate(jDate.jy, jDate.jm, jDate.jd));
                    }
                }

                $btn.on('click', function (e) {
                    logInfo('Search calendar button clicked');
                    e.preventDefault();
                    e.stopPropagation();

                    if (isDateTimeField) {
                        showPersianDateTimePicker($btn, $original, function (selectedDateTime) {
                            if (selectedDateTime) {
                                var minStr = selectedDateTime.minute < 10 ? '0' + selectedDateTime.minute : '' + selectedDateTime.minute;
                                var timeStr = selectedDateTime.hour + ':' + minStr + ' ' + selectedDateTime.ampm;
                                var pDisplay = formatPersianDate(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd) + ' ' + timeStr;
                                $persianDisplay.text(pDisplay);

                                var gDate = toGregorian(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd);
                                var formattedDate = formatJiraDateTime(gDate.gy, gDate.gm, gDate.gd, selectedDateTime.hour, selectedDateTime.minute, selectedDateTime.ampm);
                                logInfo('Search DateTime set: ' + formattedDate);
                                setInputAndTriggerEvents($original, formattedDate);
                            }
                        });
                    } else {
                        showPersianCalendar($btn, $original, function (selectedDate) {
                            if (selectedDate) {
                                var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                                var formattedDate = formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                                $persianDisplay.text(formatPersianDate(selectedDate.jy, selectedDate.jm, selectedDate.jd));
                                logInfo('Search date set: ' + formattedDate + ' / ' + formatPersianDate(selectedDate.jy, selectedDate.jm, selectedDate.jd));
                                setInputAndTriggerEvents($original, formattedDate);
                            }
                        });
                    }
                });
            } else {
                // CREATE/EDIT PAGE: Add calendar trigger without replacing the input
                logInfo('Processing Create/Edit page date input (isDateTime: ' + isDateTimeField + ')');

                // Check if we already added a button
                if ($original.next('.pc-calendar-btn').length > 0) {
                    logDebug('Persian button already exists, skipping creation');
                    return;
                }

                // Hide native calendar trigger
                $original.siblings('.aui-ss, .aui-date-picker, .icon-calendar, [class*="calendar"]').hide();
                $original.next('.icon-calendar').hide();

                // Create Persian calendar button and display span
                var $persianDisplay = $('<span class="pc-persian-display" style="margin-right:5px; color:#0052cc; font-weight:bold; font-size:12px; direction:rtl;"></span>');
                var $btn = $('<button type="button" class="aui-button pc-calendar-btn" style="margin-right:5px; background:#0052cc; color:#fff; padding:2px 8px; font-size:11px; border-radius:3px;">📅 تقویم شمسی</button>');
                
                $original.after($btn);
                $btn.after($persianDisplay);
                logInfo('Added Persian calendar button to Create/Edit input');

                // If input already has a value, show Persian equivalent
                var currentVal = $original.val();
                if (currentVal) {
                    var parsedDate = parseJiraDate(currentVal);
                    if (parsedDate) {
                        var jDate = toJalaali(parsedDate.year, parsedDate.month, parsedDate.day);
                        if (isDateTimeField) {
                            var timeMatch = currentVal.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                            var timeStr = timeMatch ? ' ' + timeMatch[0] : '';
                            $persianDisplay.text(formatPersianDate(jDate.jy, jDate.jm, jDate.jd) + timeStr);
                        } else {
                            $persianDisplay.text(formatPersianDate(jDate.jy, jDate.jm, jDate.jd));
                        }
                    }
                }

                $btn.on('click', function (e) {
                    logInfo('Create/Edit calendar button clicked');
                    e.preventDefault();
                    e.stopPropagation();

                    // Hide any native AUI datepicker that might have opened
                    try {
                        if ($original.data('aui-datepicker')) {
                            $original.data('aui-datepicker').hide();
                        }
                    } catch(ex) {}

                    if (isDateTimeField) {
                        showPersianDateTimePicker($btn, $original, function (selectedDateTime) {
                            if (selectedDateTime) {
                                var hour24 = selectedDateTime.hour;
                                if (selectedDateTime.ampm === 'PM' && hour24 !== 12) hour24 += 12;
                                if (selectedDateTime.ampm === 'AM' && hour24 === 12) hour24 = 0;
                                var hStr = hour24 < 10 ? '0' + hour24 : '' + hour24;
                                var minStr = selectedDateTime.minute < 10 ? '0' + selectedDateTime.minute : '' + selectedDateTime.minute;
                                var timeStr = hStr + ':' + minStr;
                                var pDisplay = formatPersianDate(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd) + ' ' + timeStr;
                                $persianDisplay.text(pDisplay);

                                var gDate = toGregorian(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd);
                                var formattedDate = formatJiraDateTime(gDate.gy, gDate.gm, gDate.gd, selectedDateTime.hour, selectedDateTime.minute, selectedDateTime.ampm);
                                logInfo('DateTime saved to original input: ' + formattedDate);
                                setInputAndTriggerEvents($original, formattedDate);
                            } else {
                                $persianDisplay.text('');
                                logInfo('DateTime cleared');
                                setInputAndTriggerEvents($original, '');
                            }
                        });
                    } else {
                        showPersianCalendar($btn, $original, function (selectedDate) {
                            if (selectedDate) {
                                $persianDisplay.text(formatPersianDate(selectedDate.jy, selectedDate.jm, selectedDate.jd));
                                
                                var currentVal = $original.val();
                                var exactFormat = null;
                                if (currentVal) {
                                    if (/^\d{1,2}\/[a-zA-Z]{3}\/\d{2}$/.test(currentVal)) exactFormat = 'd/MMM/yy';
                                    else if (/^\d{1,2}\/[a-zA-Z]{3}\/\d{4}$/.test(currentVal)) exactFormat = 'd/MMM/yyyy';
                                    else if (/^\d{4}-\d{2}-\d{2}$/.test(currentVal)) exactFormat = 'yyyy-MM-dd';
                                }

                                var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                                var formattedDate = exactFormat ? formatDateWithPattern(gDate.gy, gDate.gm, gDate.gd, exactFormat) : formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                                logInfo('Date saved to original input: ' + formattedDate);
                                setInputAndTriggerEvents($original, formattedDate);
                            } else {
                                $persianDisplay.text('');
                                logInfo('Date cleared');
                                setInputAndTriggerEvents($original, '');
                            }
                        });
                    }
                });

                // Prevent native calendar when original input is focused
                $original.on('focus', function(e) {
                    try {
                        if ($original.data('aui-datepicker')) {
                            $original.data('aui-datepicker').hide();
                        }
                    } catch(ex) {}
                });
            }
        });

        logInfo('Initialization complete. Inputs processed: ' + foundCount);
    }

    // ========================================================================
    // Audit Log Date Picker - Replace Atlaskit Gregorian calendar with Persian
    // ========================================================================
    // ========================================================================
    // Audit Log Date Picker - Replace Atlaskit Gregorian calendar with Persian
    // ========================================================================
    function initAuditLogDatePicker($) {
        // Only run on audit log page
        if (window.location.pathname.indexOf('/plugins/servlet/audit') === -1) {
            return;
        }

        logInfo('=== Initializing Audit Log Persian Date Picker ===');

        // --- 1) Inject CSS to hide Atlaskit calendar popups on audit page ---
        var auditCSS = document.createElement('style');
        auditCSS.id = 'pc-audit-calendar-hide';
        auditCSS.textContent = [
            '/* Hide Atlaskit calendar popup when it appears on audit page */',
            'body.pc-calendar-is-open [role="dialog"] table[role="grid"] { display: none !important; }',
            'body.pc-calendar-is-open [role="dialog"]:has(table[role="grid"]) { display: none !important; }',
            'body.pc-calendar-is-open div[data-placement] { display: none !important; }',
            '.pc-audit-hidden-calendar { display: none !important; visibility: hidden !important; pointer-events: none !important; height: 0 !important; overflow: hidden !important; }',
            '/* Style for our custom inputs */',
            '.pc-persian-audit-input { min-width: 150px; background-color: #FAFBFC; border: 2px solid #DFE1E6; border-radius: 3px; box-sizing: border-box; color: #091E42; font-family: inherit; font-size: 14px; margin: 0; padding: 4px 6px; }',
            '.pc-persian-audit-input:hover { background-color: #EBECF0; }',
            '.pc-persian-audit-input:focus { background-color: #fff; border-color: #4C9AFF; outline: none; }'
        ].join('\n');
        document.head.appendChild(auditCSS);
        logInfo('Audit calendar hide CSS injected');

        // --- 2) Detect audit date inputs ---
        function isAuditDateInput(el) {
            if (!el || el.tagName !== 'INPUT') return false;
            var ph = (el.getAttribute('placeholder') || '');
            var phLower = ph.toLowerCase();
            if (phLower.indexOf('e.g.') !== -1 && phLower.indexOf('/') !== -1 && phLower.indexOf('am') === -1 && phLower.indexOf('pm') === -1) {
                return true;
            }
            if (el.getAttribute('data-pc-audit-date') === 'true') {
                return true;
            }
            if (ph.indexOf('مثال:') !== -1) {
                return true;
            }
            return false;
        }

        // --- 3) Hide any Atlaskit calendar that appeared ---
        function hideAtlaskitCalendars() {
            var grids = document.querySelectorAll('table[role="grid"]');
            for (var i = 0; i < grids.length; i++) {
                var grid = grids[i];
                if (grid.closest('.pc-popup')) continue; // Don't hide our own
                var popup = grid.closest('[role="dialog"], [data-placement], [class*="css-"]');
                if (popup) {
                    popup.classList.add('pc-audit-hidden-calendar');
                } else {
                    var parent = grid.parentElement;
                    if (parent) {
                        parent.classList.add('pc-audit-hidden-calendar');
                    }
                }
            }

            var allThElements = document.querySelectorAll('th[role="columnheader"]');
            for (var k = 0; k < allThElements.length; k++) {
                var th = allThElements[k];
                if (th.closest('.pc-popup')) continue;
                var text = th.textContent || '';
                if (text === 'Sun' || text === 'Mon' || text === 'Sat') {
                    var calContainer = th.closest('div[style], [role="dialog"], [data-placement]');
                    if (calContainer) {
                        calContainer.classList.add('pc-audit-hidden-calendar');
                    }
                }
            }
        }

        // --- 4) Show Persian calendar for our custom input ---
        function openPersianCalendarForInput($persianInput, $originalInput) {
            logInfo('Opening Persian calendar for audit date input');

            hideAtlaskitCalendars();
            setTimeout(hideAtlaskitCalendars, 100);
            setTimeout(hideAtlaskitCalendars, 300);

            showPersianCalendar($persianInput, $originalInput, function (selectedDate) {
                if (!selectedDate) {
                    $persianInput.val('');
                    setInputAndTriggerEvents($originalInput, '');
                    return;
                }

                // Convert Persian to Gregorian
                var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                var formattedDate = gDate.gm + '/' + gDate.gd + '/' + gDate.gy; // M/d/yyyy format
                var persianStr = selectedDate.jy + '/' + selectedDate.jm + '/' + selectedDate.jd;

                logInfo('Audit date: ' + persianStr + ' → ' + formattedDate);

                $persianInput.val(persianStr);
                $persianInput.attr('title', persianStr);
                setInputAndTriggerEvents($originalInput, formattedDate);
                
            }, true);
        }

        // --- 5) Replace audit inputs with Persian ---
        function replaceAuditInputsWithPersian() {
            var allInputs = document.querySelectorAll('input:not(.pc-persian-audit-input)');
            var found = false;
            for (var i = 0; i < allInputs.length; i++) {
                var inp = allInputs[i];
                if (isAuditDateInput(inp)) {
                    var $original = $(inp);
                    
                    // Already processed?
                    if ($original.next('.pc-persian-audit-input').length > 0) continue;
                    
                    logInfo('Found Audit Date Input, replacing...');
                    found = true;
                    
                    // Hide original input
                    $original.css('display', 'none');
                    $original.attr('data-pc-audit-date', 'true');
                    
                    // Create Persian input
                    var $persian = $('<input type="text" class="pc-persian-audit-input" readonly style="cursor:pointer; direction:ltr; text-align:center;">');
                    $persian.attr('placeholder', 'انتخاب تاریخ');
                    
                    // Set initial value
                    var currentVal = $original.val();
                    if (currentVal) {
                        var parts = currentVal.split('/');
                        if (parts.length === 3) { // expected M/d/yyyy
                            var m = parseInt(parts[0], 10);
                            var d = parseInt(parts[1], 10);
                            var y = parseInt(parts[2], 10);
                            if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
                                var jDate = toJalaali(y, m, d);
                                $persian.val(jDate.jy + '/' + jDate.jm + '/' + jDate.jd);
                            }
                        }
                    }

                    $original.after($persian);
                    
                    // Prevent any native blur/focus issues
                    $original.on('focus', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        $(this).blur();
                        hideAtlaskitCalendars();
                    });

                    // Handle clicks on our custom input
                    $persian.on('mousedown click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        if (e.type === 'mousedown') {
                            var $thisPersian = $(this);
                            var $thisOriginal = $thisPersian.prev('input');
                            openPersianCalendarForInput($thisPersian, $thisOriginal);
                        }
                    });
                }
            }
            return found;
        }

        // --- 6) MutationObserver: watch for new inputs or calendars ---
        var auditMutObserver = new MutationObserver(function (mutations) {
            var shouldCheck = false;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes.length > 0) {
                    shouldCheck = true;
                    break;
                }
            }
            if (shouldCheck) {
                hideAtlaskitCalendars();
                replaceAuditInputsWithPersian();
            }
        });
        auditMutObserver.observe(document.body, { childList: true, subtree: true });

        // Run placeholder update with retries
        [500, 1000, 2000, 3000, 5000].forEach(function (delay) {
            setTimeout(replaceAuditInputsWithPersian, delay);
        });

        logInfo('Audit Log Persian Date Picker initialized');
    }

    // Main initialization
    waitForJira(function ($) {
        logInfo('========================================');
        logInfo('Persian Calendar Plugin v' + PC_VERSION + ' Starting');
        logInfo('========================================');

        // Fetch date format settings from REST API first
        fetchDateFormatSettings();

        // Analyze page first
        analyzePageForDateElements();

        // Initial run
        setTimeout(function () {
            initPersianCalendar($);
            convertViewPageDates($);
            initInlineEditCalendar($);
            // v11.4.0: New date display converters
            convertActivityStreamTime($);
            convertAuditLogDates($);
            initAuditLogDatePicker($);
            convertIssueSearchDates($);
            convertTimeSpentDurations($);
            // Setup livestamp observer for dynamic updates
            setupLivestampObserver($);
        }, 500);

        // Re-run on AJAX content
        if (typeof JIRA !== 'undefined' && JIRA.bind) {
            logInfo('JIRA framework detected, binding to NEW_CONTENT_ADDED');
            JIRA.bind(JIRA.Events.NEW_CONTENT_ADDED, function () {
                logDebug('NEW_CONTENT_ADDED event fired');
                setTimeout(function () {
                    analyzePageForDateElements();
                    initPersianCalendar($);
                    convertViewPageDates($);
                    // v11.4.0: New date display converters
                    convertActivityStreamTime($);
                    convertAuditLogDates($);
            convertIssueSearchDates($);
                    convertTimeSpentDurations($);
                }, 200);
            });
        } else {
            logWarn('JIRA framework not detected - using fallback for JSM Customer Portal');

            // For JSM Customer Portal: run conversion multiple times with delays
            // since content loads dynamically
            var jsmConversionDelays = [1000, 2000, 3000, 5000];
            jsmConversionDelays.forEach(function (delay) {
                setTimeout(function () {
                    logDebug('JSM delayed conversion at ' + delay + 'ms');
                    convertViewPageDates($);
                    // v11.4.0: New date display converters
                    convertActivityStreamTime($);
                    convertAuditLogDates($);
            convertIssueSearchDates($);
                    convertTimeSpentDurations($);
                }, delay);
            });
        }

        // Also observe DOM changes
        var observer = new MutationObserver(function (mutations) {
            var shouldInit = false;
            var shouldConvertDates = false;

            mutations.forEach(function (mutation) {
                if (mutation.addedNodes.length > 0) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        if (node.nodeType === 1) {
                            // Jira Core patterns
                            if (node.id === 'duedate' || (node.querySelector && node.querySelector('#duedate, [name="duedate"]'))) {
                                logDebug('MutationObserver: Found date input element in DOM change');
                                shouldInit = true;
                            }
                            // JSM Customer Portal patterns
                            if (node.querySelector && node.querySelector('[data-test-cv-dummy-text], .cv-request-details, .activity-item-request-fields')) {
                                logDebug('MutationObserver: Found JSM date element in DOM change');
                                shouldConvertDates = true;
                            }
                            // Also check if the node itself has date-related content or relevant classes
                            var content = node.textContent || '';
                            var className = (node.className && typeof node.className === 'string') ? node.className : '';

                            // Patterns for English durations, relative times, and history fields
                            var hasTimeContent = content.match(/minute|hour|ago|now|yesterday|tomorrow|Original|New:|Old Value|GMT|[AP]M|january|february|march|april|may|june|july|august|september|october|november|december|\d{4}-\d{2}-\d{2}T/i);
                            var hasRelevantClass = className.indexOf('worklog') !== -1 ||
                                className.indexOf('activity') !== -1 ||
                                className.indexOf('history') !== -1 ||
                                className.indexOf('livestamp') !== -1;

                            // If an iframe is added, or a container that might contain iframes
                            var containsIframe = (node.tagName === 'IFRAME' || (node.querySelector && node.querySelector('iframe')));

                            if (node.hasAttribute && (node.hasAttribute('data-test-cv-dummy-text') ||
                                (content.match(/\d{1,2}\/[A-Z][a-z]{2}\/\d{2}/)) ||
                                hasTimeContent ||
                                hasRelevantClass ||
                                containsIframe)) {
                                shouldConvertDates = true;
                                logDebug('MutationObserver triggered update', { tag: node.tagName, class: className });
                            }
                        }
                    }
                }
            });

            if (shouldInit) {
                setTimeout(function () { initPersianCalendar($); }, 100);
            }
            if (shouldConvertDates) {
                setTimeout(function () {
                    convertViewPageDates($);
                    // v11.4.0: New date display converters
                    convertActivityStreamTime($);
                    convertAuditLogDates($);
            convertIssueSearchDates($);
                    convertTimeSpentDurations($);
                }, 100);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        logInfo('MutationObserver attached');

        // ========== REACT PORTAL INTERCEPTOR ==========
        // Aggressive React interceptor removed.

        // ========== JXL SUPPORT ==========
        try {
            logInfo('Starting JXL Support initialization...');
            initJXLSupport($);
        } catch (jxlError) {
            logError('JXL Support initialization failed', { error: jxlError.message, stack: jxlError.stack });
        }
    });

    // ========== NON-AGGRESSIVE REACT PORTAL SUPPORT ==========
    // The aggressive scanner has been removed for better stability.
    // ========== JXL (Jira eXtensible List) SUPPORT ==========
    function initJXLSupport($) {
        logInfo('JXL: initJXLSupport function called');

        // English month names for parsing
        var ENGLISH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var ENGLISH_MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        // Track converted elements to avoid re-conversion
        var convertedElements = new WeakSet();

        // Date patterns that JXL might use
        var DATE_PATTERNS = [
            // Dec 23, 2025
            /^([A-Z][a-z]{2})\s+(\d{1,2}),?\s+(\d{4})$/,
            // December 23, 2025
            /^([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
            // 23 Dec 2025
            /^(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})$/,
            // 2025-12-23
            /^(\d{4})-(\d{2})-(\d{2})$/,
            // 12/23/2025
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        ];

        function parseEnglishMonth(monthStr) {
            var idx = ENGLISH_MONTHS.indexOf(monthStr);
            if (idx === -1) {
                idx = ENGLISH_MONTHS_FULL.indexOf(monthStr);
            }
            return idx !== -1 ? idx + 1 : null;
        }

        function parseJXLDate(text) {
            if (!text || typeof text !== 'string') return null;
            text = text.trim();

            var match;
            // Common time regex part: optional HH:MM and optional AM/PM
            // Matches: 10:30, 10:30 PM, 10:30PM, 22:30
            var timeRegex = /(?:\s+(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?)?$/;

            // Helper to extract time from match result
            // assumes time groups are at indices: yearIdx+1, yearIdx+2, yearIdx+3
            function extractTime(m, yearIdx) {
                if (m[yearIdx + 1]) {
                    return {
                        hour: parseInt(m[yearIdx + 1]),
                        minute: parseInt(m[yearIdx + 2]),
                        ampm: m[yearIdx + 3] ? m[yearIdx + 3].toUpperCase() : null
                    };
                }
                return null;
            }

            // Pattern 1: Dec 23, 2025 [10:30 PM]
            // Groups: 1=Month, 2=Day, 3=Year, 4=Hour, 5=Min, 6=AM/PM
            match = text.match(new RegExp('^([A-Z][a-z]{2,})\\s+(\\d{1,2}),?\\s+(\\d{4})' + timeRegex.source));
            if (match) {
                var month = parseEnglishMonth(match[1]);
                if (month) {
                    var result = { year: parseInt(match[3]), month: month, day: parseInt(match[2]) };
                    var time = extractTime(match, 3);
                    if (time) Object.assign(result, time);
                    return result;
                }
            }

            // Pattern 2: 23 Dec 2025 [10:30 PM]
            // Groups: 1=Day, 2=Month, 3=Year, 4=Hour, 5=Min, 6=AM/PM
            match = text.match(new RegExp('^(\\d{1,2})\\s+([A-Z][a-z]{2,})\\s+(\\d{4})' + timeRegex.source));
            if (match) {
                var month = parseEnglishMonth(match[2]);
                if (month) {
                    var result = { year: parseInt(match[3]), month: month, day: parseInt(match[1]) };
                    var time = extractTime(match, 3);
                    if (time) Object.assign(result, time);
                    return result;
                }
            }

            // Pattern 3: 2025-12-23 [10:30]
            // Groups: 1=Year, 2=Month, 3=Day, 4=Hour, 5=Min, 6=AM/PM
            match = text.match(new RegExp('^(\\d{4})-(\\d{2})-(\\d{2})' + timeRegex.source));
            if (match) {
                var result = { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
                var time = extractTime(match, 3);
                if (time) Object.assign(result, time);
                return result;
            }

            // Pattern 4: 12/23/2025 [10:30 PM]
            // Groups: 1=Month, 2=Day, 3=Year, 4=Hour, 5=Min, 6=AM/PM
            match = text.match(new RegExp('^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})' + timeRegex.source));
            if (match) {
                var result = { year: parseInt(match[3]), month: parseInt(match[1]), day: parseInt(match[2]) };
                var time = extractTime(match, 3);
                if (time) Object.assign(result, time);
                return result;
            }

            return null;
        }

        function convertDateTextToPersian(text) {
            var parsed = parseJXLDate(text);
            if (!parsed) return null;

            try {
                var persian = toJalaali(parsed.year, parsed.month, parsed.day);
                var dateStr = persian.jy + '/' + persian.jm + '/' + persian.jd;

                if (parsed.hour !== undefined) {
                    var timeStr = parsed.hour + ':' + (parsed.minute < 10 ? '0' + parsed.minute : parsed.minute);
                    if (parsed.ampm) {
                        timeStr += ' ' + parsed.ampm;
                    }
                    return dateStr + ' ' + timeStr;
                }

                return dateStr;
            } catch (e) {
                logError('Error converting date to Persian', { text: text, error: e.message });
                return null;
            }
        }

        function processJXLIframe(iframe) {
            try {
                var iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                if (!iframeDoc) {
                    logDebug('JXL: Cannot access iframe document (cross-origin?)');
                    return;
                }

                logInfo('JXL: Processing iframe content');
                convertJXLDates(iframeDoc);
                observeJXLChanges(iframeDoc, iframe);
                interceptJXLCalendar(iframeDoc, iframe);

            } catch (e) {
                logError('JXL: Error processing iframe', { error: e.message });
            }
        }

        function convertJXLDates(doc) {
            if (!doc || !doc.body) return;

            var converted = 0;

            // Find all text nodes that might contain dates
            var walker = doc.createTreeWalker(
                doc.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            var nodesToProcess = [];
            while (walker.nextNode()) {
                var node = walker.currentNode;
                var text = node.textContent.trim();

                // Skip if already converted or empty
                if (!text || text.length < 6 || text.length > 30) continue;
                if (text.indexOf('/') !== -1 && text.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) continue; // Already Persian

                var parsed = parseJXLDate(text);
                if (parsed) {
                    nodesToProcess.push({ node: node, text: text });
                }
            }

            // Process found date nodes
            nodesToProcess.forEach(function (item) {
                var parent = item.node.parentElement;
                if (!parent || convertedElements.has(parent)) return;

                var persian = convertDateTextToPersian(item.text);
                if (persian) {
                    item.node.textContent = persian;
                    convertedElements.add(parent);
                    converted++;

                    // Style the parent for RTL
                    parent.style.direction = 'ltr';
                    parent.style.fontFamily = 'Tahoma, Arial, sans-serif';
                }
            });

            if (converted > 0) {
                logInfo('JXL: Converted ' + converted + ' dates to Persian');
            }
        }

        function observeJXLChanges(iframeDoc, iframe) {
            if (!iframeDoc || !iframeDoc.body) return;

            var jxlObserver = new MutationObserver(function (mutations) {
                var hasNewContent = false;
                mutations.forEach(function (mutation) {
                    if (mutation.addedNodes.length > 0) {
                        hasNewContent = true;
                    }
                });

                if (hasNewContent) {
                    // Debounce conversion
                    clearTimeout(iframe._jxlConvertTimeout);
                    iframe._jxlConvertTimeout = setTimeout(function () {
                        convertJXLDates(iframeDoc);
                    }, 200);
                }
            });

            jxlObserver.observe(iframeDoc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });

            logDebug('JXL: MutationObserver attached to iframe');
        }

        function interceptJXLCalendar(iframeDoc, iframe) {
            if (!iframeDoc || !iframeDoc.body) return;

            // Listen for clicks on date cells to debug specific structure
            iframeDoc.body.addEventListener('click', function (e) {
                var target = e.target;

                // Log what was clicked to understand structure
                logInfo('JXL Debug: Click intercepted', { tagName: target.tagName, className: target.className });

                // Check behavior: Does an input appear after a short delay?
                setTimeout(function () {
                    var inputs = iframeDoc.body.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"]');
                    logInfo('JXL Debug: Inputs found', { count: inputs.length });

                    if (inputs.length > 0) {
                        inputs.forEach(function (input) {
                            // Filter 1: Only allow text-like inputs and textareas (skips file inputs, checkboxes, searches, etc.)
                            var type = (input.getAttribute('type') || 'text').toLowerCase();
                            if (type !== 'text' && input.tagName !== 'TEXTAREA') {
                                return;
                            }

                            // Filter 2: Verify if the input value matches a date pattern (or relies on calendarObserver for empty inputs)
                            var val = (input.value || '').trim();
                            var looksLikeDate = false;
                            if (val) {
                                for (var i = 0; i < DATE_PATTERNS.length; i++) {
                                    if (DATE_PATTERNS[i].test(val)) {
                                        looksLikeDate = true;
                                        break;
                                    }
                                }
                            }

                            if (!looksLikeDate) {
                                return; // Let non-date text inputs behave normally
                            }

                            // Attach Persian Calendar if not already attached
                            if (!input.dataset.pcAttached) {
                                input.dataset.pcAttached = 'true';
                                // Determine if it needs time
                                var isDateTime = val.indexOf(':') !== -1;

                                input.addEventListener('click', function (ev) {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    if (isDateTime) {
                                        showPersianDateTimePicker(jQuery(input), jQuery(input), function (date) {
                                            // Handled
                                        });
                                    } else {
                                        showPersianCalendar(jQuery(input), jQuery(input), function (date) {
                                            // Handled
                                        });
                                    }
                                });
                            }
                        });
                    }
                }, 300);

            }, true);

            function setJXLInputValue(input, value) {
                if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                } else {
                    input.innerText = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            // ... MutationObserver for calendar popup ...


            // Intercept native calendar if it appears
            var calendarObserver = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(function (node) {
                            if (node.nodeType === 1) { // Element
                                var className = (node.className || '').toLowerCase();
                                var nodeHtml = node.innerHTML || '';
                                logInfo('JXL Debug: Node added', { tagName: node.tagName, className: className.substring(0, 50) });

                                // Heuristic detection:
                                // 1. Standard class names
                                var isCalendar =
                                    className.indexOf('calendar') !== -1 ||
                                    className.indexOf('datepicker') !== -1 ||
                                    className.indexOf('date-picker') !== -1 ||
                                    node.querySelector('.calendar, .datepicker, .DayPicker, [class*="calendar"]');

                                // 2. ARIA / Role checks (Atlaskit often uses these)
                                if (!isCalendar) {
                                    var role = node.getAttribute('role');
                                    var ariaLabel = node.getAttribute('aria-label');
                                    if ((role === 'dialog' || role === 'application' || role === 'presentation') &&
                                        (nodeHtml.indexOf('Sun') !== -1 || nodeHtml.indexOf('Mon') !== -1 || nodeHtml.indexOf('202') !== -1)) {
                                        isCalendar = true;
                                        logInfo('JXL: Inferred calendar from structure/content');
                                    }
                                }

                                // 3. Aggressive check: ANY div added shortly after a click if we can't find specific classes
                                // (This relies on the fact that we just clicked a cell)
                                // We'll verify if it contains a table-like structure
                                if (!isCalendar && node.tagName === 'DIV' && (nodeHtml.indexOf('<table') !== -1 || nodeHtml.indexOf('grid') !== -1)) {
                                    // Check for month names
                                    if (nodeHtml.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/)) {
                                        isCalendar = true;
                                        logInfo('JXL: Inferred calendar from month names');
                                    }
                                }

                                if (isCalendar) {
                                    logInfo('JXL: Detected calendar popup, attempting to replace with Persian');

                                    // Try to identify the active input
                                    var activeInput = iframeDoc.activeElement;
                                    logInfo('JXL: Active element is', { tagName: activeInput ? activeInput.tagName : 'null' });

                                    // If no active input, try to find one related to the popup? 
                                    // Often the input is the LAST focused element.
                                    var inputs = iframeDoc.querySelectorAll('input:not([type="hidden"]), textarea');
                                    if (!activeInput || activeInput.tagName === 'BODY') {
                                        // Fallback: assume the last added input is the one
                                        if (inputs.length > 0) activeInput = inputs[inputs.length - 1];
                                    }

                                    if (activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA' || activeInput.getAttribute('contenteditable') === 'true')) {

                                        // Hide native popup immediately
                                        node.style.display = 'none';
                                        node.style.visibility = 'hidden';
                                        node.setAttribute('hidden', 'true');

                                        // Show Persian Calendar
                                        var val = (activeInput.value || activeInput.innerText || '').trim();
                                        var isDateTime = val.indexOf(':') !== -1;

                                        logInfo('JXL: Force-showing Persian calendar on active input', { isDateTime: isDateTime });

                                        if (isDateTime) {
                                            showPersianDateTimePicker(jQuery(activeInput), jQuery(activeInput), function (date) {
                                                var gDate = toGregorian(date.jy, date.jm, date.jd);
                                                var dateStr = formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                                                var timeStr = date.hour + ':' + (date.minute < 10 ? '0' + date.minute : date.minute) + ' ' + date.ampm;
                                                var finalStr = dateStr + ' ' + timeStr;
                                                setJXLInputValue(activeInput, finalStr);
                                            });
                                        } else {
                                            showPersianCalendar(jQuery(activeInput), jQuery(activeInput), function (date) {
                                                var gDate = toGregorian(date.jy, date.jm, date.jd);
                                                var dateStr = formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                                                setJXLInputValue(activeInput, dateStr);
                                            });
                                        }
                                    } else {
                                        logInfo('JXL: No active input found, converting popup content instead');
                                        convertJXLDates(node);
                                    }
                                }
                            }
                        });
                    }
                });
            });

            calendarObserver.observe(iframeDoc.body, { childList: true, subtree: true });
            logDebug('JXL: Calendar interceptor attached');
        }

        function findAndProcessJXLIframes() {
            // Look for JXL iframes
            var selectors = [
                'iframe[data-src*="app.jxl"]',
                'iframe[src*="app.jxl"]',
                'iframe[data-src*="jxl"]',
                'iframe[src*="jxl"]',
                'iframe[class*="jxl"]',
                'iframe[id*="jxl"]',
                // Also try generic iframe in JXL containers
                '.itsfine-sconnect-layout iframe',
                '[data-project-key] iframe'
            ];

            var foundIframes = [];
            selectors.forEach(function (selector) {
                try {
                    var iframes = document.querySelectorAll(selector);
                    iframes.forEach(function (iframe) {
                        if (foundIframes.indexOf(iframe) === -1) {
                            foundIframes.push(iframe);
                        }
                    });
                } catch (e) { }
            });

            if (foundIframes.length > 0) {
                logInfo('JXL: Found ' + foundIframes.length + ' JXL iframe(s)');
                foundIframes.forEach(function (iframe) {
                    // Process immediately if loaded
                    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                        processJXLIframe(iframe);
                    }

                    // Also listen for load event
                    iframe.addEventListener('load', function () {
                        logDebug('JXL: iframe loaded');
                        setTimeout(function () {
                            processJXLIframe(iframe);
                        }, 500);
                    });
                });
            }
        }

        // Initial scan for JXL iframes
        setTimeout(findAndProcessJXLIframes, 1000);

        // Also watch for dynamically added iframes
        var iframeObserver = new MutationObserver(function (mutations) {
            var foundNewIframe = false;
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'IFRAME') {
                            var src = node.getAttribute('src') || node.getAttribute('data-src') || '';
                            if (src.toLowerCase().indexOf('jxl') !== -1) {
                                foundNewIframe = true;
                            }
                        }
                        // Also check children
                        if (node.querySelector) {
                            var childIframes = node.querySelectorAll('iframe[src*="jxl"], iframe[data-src*="jxl"]');
                            if (childIframes.length > 0) {
                                foundNewIframe = true;
                            }
                        }
                    }
                });
            });

            if (foundNewIframe) {
                setTimeout(findAndProcessJXLIframes, 500);
            }
        });

        iframeObserver.observe(document.body, { childList: true, subtree: true });
        logInfo('JXL: Iframe observer attached');
    }

})();
