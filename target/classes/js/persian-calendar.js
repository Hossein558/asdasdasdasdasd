/**
 * Persian Calendar Integration for Jira
 * Version 1.1 - With Detailed Logging
 * Replaces the default Gregorian date picker with Persian/Shamsi calendar
 * Stores data in Gregorian format
 */

(function () {
    'use strict';

    // ========== LOGGING SYSTEM ==========
    var PC_LOG_PREFIX = '[PC-PERSIAN-CALENDAR]';
    var PC_VERSION = '10.3.9';

    function pcLog(level, message, data) {
        var timestamp = new Date().toISOString();
        var logEntry = timestamp + ' ' + PC_LOG_PREFIX + ' [' + level + '] ' + message;
        if (data !== undefined) {
            logEntry += ' | Data: ' + JSON.stringify(data);
        }

        switch (level) {
            case 'ERROR':
                console.error(logEntry);
                break;
            case 'WARN':
                console.warn(logEntry);
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
    function waitForJira(callback) {
        logDebug('Waiting for Jira framework...');
        if (typeof AJS !== 'undefined' && AJS.$) {
            logInfo('Found AJS framework');
            callback(AJS.$);
        } else if (typeof jQuery !== 'undefined') {
            logInfo('Found jQuery (no AJS)');
            callback(jQuery);
        } else {
            logDebug('Framework not ready, retrying in 100ms...');
            setTimeout(function () { waitForJira(callback); }, 100);
        }
    }

    // Persian month names
    var PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    var PERSIAN_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    var GREGORIAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

    // Parse Jira date format
    function parseJiraDate(dateStr) {
        if (!dateStr) return null;
        logDebug('Parsing date: ' + dateStr);
        var parts = dateStr.trim().split('/');
        if (parts.length !== 3) {
            logWarn('Invalid date format (not 3 parts)', { input: dateStr });
            return null;
        }
        var d = parseInt(parts[0], 10);
        var mStr = parts[1];
        var y = parseInt(parts[2], 10);
        var m = GREGORIAN_MONTHS.indexOf(mStr);
        if (m === -1) {
            logWarn('Unknown month: ' + mStr);
            return null;
        }
        if (y < 100) y += 2000;
        var result = { year: y, month: m + 1, day: d };
        logDebug('Parsed date result', result);
        return result;
    }

    function formatJiraDate(year, month, day) {
        var yy = year % 100;
        var yyStr = yy < 10 ? '0' + yy : '' + yy;
        return day + '/' + GREGORIAN_MONTHS[month - 1] + '/' + yyStr;
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
            '.pc-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9998; }',
            '.pc-popup { position: absolute; z-index: 9999; background: #fff; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); width: 300px; padding: 12px; direction: rtl; font-family: Tahoma, Arial, sans-serif; }',
            '.pc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; }',
            '.pc-header button { background: #f4f5f7; border: 1px solid #ddd; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 14px; }',
            '.pc-header button:hover { background: #e4e5e7; }',
            '.pc-title { font-weight: bold; font-size: 15px; color: #172b4d; }',
            '.pc-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 6px; }',
            '.pc-weekdays span { font-size: 12px; color: #6b778c; padding: 6px 0; font-weight: bold; }',
            '.pc-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }',
            '.pc-day { text-align: center; padding: 10px 4px; cursor: pointer; border-radius: 4px; font-size: 14px; transition: all 0.1s; }',
            '.pc-day:not(.empty):hover { background: #deebff; }',
            '.pc-day.empty { cursor: default; }',
            '.pc-day.today { background: #e3fcef; color: #006644; font-weight: bold; border: 1px solid #79f2c0; }',
            '.pc-day.selected { background: #0052cc !important; color: #fff !important; }',
            '.pc-footer { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee; }',
            '.pc-footer button { background: #f4f5f7; border: 1px solid #ddd; border-radius: 4px; padding: 8px 14px; cursor: pointer; font-size: 13px; font-family: inherit; }',
            '.pc-footer button:hover { background: #e4e5e7; }',
            '.pc-footer button.primary { background: #0052cc; color: #fff; border-color: #0052cc; }',
            '.pc-footer button.primary:hover { background: #0065ff; }',
            // Time picker styles
            '.pc-time-picker { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee; direction: ltr; }',
            '.pc-time-picker label { font-size: 13px; color: #5e6c84; margin-left: 8px; }',
            '.pc-time-picker input { width: 50px; text-align: center; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }',
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
    function showPersianCalendar($input, $originalInput, onSelect) {
        logInfo('Opening Persian calendar popup');

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

        // Create overlay
        var overlay = document.createElement('div');
        overlay.className = 'pc-overlay';
        document.body.appendChild(overlay);

        // Create popup
        var popup = document.createElement('div');
        popup.className = 'pc-popup';
        document.body.appendChild(popup);

        // Position popup - smart positioning to avoid going off-screen
        var inputEl = $input[0] || $input;
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

        popup.style.top = topPos + 'px';
        popup.style.left = leftPos + 'px';
        popup.style.maxHeight = (viewportHeight - 40) + 'px';
        popup.style.overflowY = 'auto';
        logDebug('Popup positioned at', { top: popup.style.top, left: popup.style.left, spaceBelow: spaceBelow, spaceAbove: spaceAbove });

        function render() {
            logDebug('Rendering calendar for', { year: viewYear, month: viewMonth });

            var html = '<div class="pc-header">';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">&laquo;</button>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">&lsaquo;</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">&rsaquo;</button>';
            html += '<button type="button" class="pc-next-year" title="سال بعد">&raquo;</button>';
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
                var classes = 'pc-day';
                if (isSelected) classes += ' selected';
                if (isToday) classes += ' today';
                html += '<span class="' + classes + '" data-day="' + d + '">' + d + '</span>';
            }

            html += '</div>';

            html += '<div class="pc-footer">';
            html += '<button type="button" class="pc-confirm primary">تأیید</button>';
            html += '<button type="button" class="pc-today">امروز</button>';
            html += '<button type="button" class="pc-clear">پاک کردن</button>';
            html += '</div>';

            popup.innerHTML = html;
        }

        function close() {
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

        // Event delegation
        popup.addEventListener('click', function (e) {
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
            e.stopPropagation();
        });

        overlay.addEventListener('click', function () {
            logDebug('Overlay clicked, closing');
            close();
        });

        render();
    }

    // Create and show Persian DateTime picker popup (Date + Time)
    function showPersianDateTimePicker($input, $originalInput, onSelect) {
        logInfo('Opening Persian DateTime picker popup');

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

        // Create popup
        var popup = document.createElement('div');
        popup.className = 'pc-popup';
        document.body.appendChild(popup);

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

            var html = '<div class="pc-header">';
            html += '<button type="button" class="pc-next-year" title="سال بعد">&raquo;</button>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">&rsaquo;</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">&lsaquo;</button>';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">&laquo;</button>';
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
                var cls = 'pc-day';
                if (d === todayJ.jd && viewMonth === todayJ.jm && viewYear === todayJ.jy) {
                    cls += ' today';
                }
                if (selectedDate && d === selectedDate.jd && viewMonth === selectedDate.jm && viewYear === selectedDate.jy) {
                    cls += ' selected';
                }
                html += '<span class="' + cls + '" data-day="' + d + '">' + d + '</span>';
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

            html += '<div class="pc-footer">';
            html += '<button type="button" class="pc-confirm primary">تأیید</button>';
            html += '<button type="button" class="pc-today">الان</button>';
            html += '<button type="button" class="pc-clear">پاک کردن</button>';
            html += '</div>';

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
            logDebug('Closing DateTime picker popup');
            popup.remove();
            overlay.remove();
        }

        function selectDay(day) {
            selectedDate = { jy: viewYear, jm: viewMonth, jd: day };
            logDebug('Day selected', selectedDate);
            render();
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

        // Event delegation
        popup.addEventListener('click', function (e) {
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
                var result = {
                    jy: selectedDate.jy,
                    jm: selectedDate.jm,
                    jd: selectedDate.jd,
                    hour: selectedHour,
                    minute: selectedMinute,
                    ampm: selectedAmPm
                };
                onSelect(result);
                close();
            } else if (target.classList.contains('pc-clear')) {
                logInfo('Clear button clicked');
                onSelect(null);
                close();
            } else if (target.classList.contains('pc-confirm')) {
                confirm();
            }
            e.preventDefault();
            e.stopPropagation();
        });

        overlay.addEventListener('click', function () {
            logDebug('Overlay clicked, closing');
            close();
        });

        render();
    }

    // Convert date displays on View page (sidebar dates like Due, Plan Date, etc.)
    function convertViewPageDates($) {
        logInfo('=== Converting View Page Dates ===');

        // Selectors for date display elements in the issue detail sidebar
        var dateValueSelectors = [
            // Due date in detail view
            '#due-date .value time',
            '#due-date .value',
            '#customfield_10015-val time',  // Plan Date
            '#customfield_10015-val',
            // Generic date display patterns
            '.item-details .date-value',
            '.dates-module .value time',
            '.dates-module .value',
            // Description area date displays
            '[data-field-id="duedate"] .value',
            '[data-field-id="duedate"] time',
            // Any time element with datetime attribute containing date
            '.details-layout time[datetime]',
            '#issuedetails .value time',
            '#datesmodule .value',
            '#datesmodule time'
        ];

        var convertedCount = 0;

        $(dateValueSelectors.join(',')).each(function () {
            var $el = $(this);

            // Skip if already converted
            if ($el.data('pc-converted')) {
                return;
            }

            var text = $el.text().trim();

            // Try to parse Jira date format (d/MMM/yy or similar)
            var parsed = parseJiraDate(text);
            if (parsed) {
                var jDate = toJalaali(parsed.year, parsed.month, parsed.day);
                var persianText = formatPersianDate(jDate.jy, jDate.jm, jDate.jd);

                // Save original for tooltip
                $el.attr('title', text + ' = ' + persianText);
                $el.text(persianText);
                $el.data('pc-converted', true);
                $el.css('direction', 'rtl');

                logInfo('Converted date: ' + text + ' → ' + persianText);
                convertedCount++;
            }
        });

        logInfo('View page dates converted: ' + convertedCount);
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
            var isKnownDateTimeField =
                $original.attr('id') === 'log-work-form-date-logged-date-picker' ||
                $original.attr('id') === 'log-work-date-logged-date-picker' ||
                $original.attr('name') === 'startDate' ||
                $original.attr('name') === 'worklog_startDate';

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

                    showPersianCalendar($btn, $original, function (selectedDate) {
                        if (selectedDate) {
                            var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                            var formattedDate = formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                            $original.val(formattedDate);
                            $persianDisplay.text(formatPersianDate(selectedDate.jy, selectedDate.jm, selectedDate.jd));
                            logInfo('Search date set: ' + formattedDate + ' / ' + formatPersianDate(selectedDate.jy, selectedDate.jm, selectedDate.jd));
                            $original.trigger('change').trigger('input').trigger('blur');
                        }
                    });
                });
            } else {
                // CREATE/EDIT PAGE: Replace the input completely
                logInfo('Processing Create/Edit page date input (isDateTime: ' + isDateTimeField + ')');

                // Check if Persian input already exists (for inline edit re-renders)
                if ($original.next('.pc-persian-input').length > 0) {
                    logDebug('Persian input already exists, skipping creation');
                    return;
                }

                // Hide original input
                $original.css('display', 'none');
                logDebug('Hidden original input');

                // Also hide calendar trigger
                $original.siblings('.aui-ss, .aui-date-picker, .icon-calendar, [class*="calendar"]').hide();
                $original.next().hide();

                // Create Persian input with unique class
                var placeholderText = isDateTimeField ? 'انتخاب تاریخ و ساعت' : 'انتخاب تاریخ';
                var $persian = $('<input type="text" class="text medium-field pc-persian-input" readonly style="cursor:pointer; direction:rtl; text-align:right;">');
                $persian.attr('placeholder', placeholderText);
                $original.after($persian);
                logInfo('Created Persian input field');

                // Set initial value
                var currentVal = $original.val();
                if (currentVal) {
                    logDebug('Setting initial value from: ' + currentVal);
                    var gDate = parseJiraDate(currentVal);
                    if (gDate) {
                        var jDate = toJalaali(gDate.year, gDate.month, gDate.day);
                        if (isDateTimeField) {
                            // Parse time part
                            var timeMatch = currentVal.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                            var timeStr = timeMatch ? ' ' + timeMatch[0] : '';
                            $persian.val(formatPersianDate(jDate.jy, jDate.jm, jDate.jd) + timeStr);
                        } else {
                            $persian.val(formatPersianDate(jDate.jy, jDate.jm, jDate.jd));
                        }
                        logInfo('Initial Persian date set: ' + $persian.val());
                    }
                }

                // Click handler - different for Date vs DateTime
                if (isDateTimeField) {
                    // DateTime picker with time selection
                    $persian.on('click', function (e) {
                        logInfo('Persian DateTime input clicked');
                        e.preventDefault();
                        e.stopPropagation();

                        showPersianDateTimePicker($persian, $original, function (selectedDateTime) {
                            if (selectedDateTime) {
                                // Format display value (Persian)
                                var hour12 = selectedDateTime.hour;
                                var minute = selectedDateTime.minute < 10 ? '0' + selectedDateTime.minute : selectedDateTime.minute;
                                var timeStr = hour12 + ':' + minute + ' ' + selectedDateTime.ampm;
                                $persian.val(formatPersianDate(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd) + ' ' + timeStr);

                                // Format Jira value (Gregorian with time)
                                var gDate = toGregorian(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd);
                                var formattedDate = formatJiraDate(gDate.gy, gDate.gm, gDate.gd) + ' ' + timeStr;
                                $original.val(formattedDate);
                                logInfo('DateTime saved to original input: ' + formattedDate);
                                $original.trigger('change');
                            } else {
                                $persian.val('');
                                $original.val('');
                                logInfo('DateTime cleared');
                                $original.trigger('change');
                            }
                        });
                    });
                } else {
                    // Date-only picker
                    $persian.on('click', function (e) {
                        logInfo('Persian input clicked');
                        e.preventDefault();
                        e.stopPropagation();

                        showPersianCalendar($persian, $original, function (selectedDate) {
                            if (selectedDate) {
                                $persian.val(formatPersianDate(selectedDate.jy, selectedDate.jm, selectedDate.jd));
                                var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                                var formattedDate = formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                                $original.val(formattedDate);
                                logInfo('Date saved to original input: ' + formattedDate);
                                $original.trigger('change');
                            } else {
                                $persian.val('');
                                $original.val('');
                                logInfo('Date cleared');
                                $original.trigger('change');
                            }
                        });
                    });
                }

                // Prevent original calendar from opening
                $original.off('click focus');
                $original.on('click focus', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
            }
        });

        logInfo('Initialization complete. Inputs processed: ' + foundCount);
    }

    // Main initialization
    waitForJira(function ($) {
        logInfo('========================================');
        logInfo('Persian Calendar Plugin v' + PC_VERSION + ' Starting');
        logInfo('========================================');

        // Analyze page first
        analyzePageForDateElements();

        // Initial run
        setTimeout(function () {
            initPersianCalendar($);
            convertViewPageDates($);
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
                }, 200);
            });
        } else {
            logWarn('JIRA framework not detected');
        }

        // Also observe DOM changes
        var observer = new MutationObserver(function (mutations) {
            var shouldInit = false;
            mutations.forEach(function (mutation) {
                if (mutation.addedNodes.length > 0) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        if (node.nodeType === 1 && (node.id === 'duedate' || (node.querySelector && node.querySelector('#duedate, [name="duedate"]')))) {
                            logDebug('MutationObserver: Found duedate element in DOM change');
                            shouldInit = true;
                            break;
                        }
                    }
                }
            });
            if (shouldInit) {
                setTimeout(function () { initPersianCalendar($); }, 100);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        logInfo('MutationObserver attached');
    });

})();
