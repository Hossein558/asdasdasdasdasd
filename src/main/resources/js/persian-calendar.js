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
    var PC_VERSION = '10.3.31';

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
        // Format: d/MMM/yy (e.g., 9/Dec/25 or 19/Dec/25)
        var yy = year % 100;
        var yyStr = yy < 10 ? '0' + yy : '' + yy;
        return day + '/' + GREGORIAN_MONTHS[month - 1] + '/' + yyStr;
    }

    function formatJiraDateTime(year, month, day, hour, minute, ampm) {
        // Format: dd/MMM/yy h:mm a (e.g., 19/Dec/25 6:30 PM)
        var yy = year % 100;
        var yyStr = yy < 10 ? '0' + yy : '' + yy;
        var dayStr = day < 10 ? '0' + day : '' + day;
        var minStr = minute < 10 ? '0' + minute : '' + minute;
        return dayStr + '/' + GREGORIAN_MONTHS[month - 1] + '/' + yyStr + ' ' + hour + ':' + minStr + ' ' + ampm;
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
            // Livestamp elements
            '.activity-container .livestamp',
            '.actionContainer .livestamp',
            // Time elements
            '.actionContainer time',
            '.action-details time',
            '#activitymodule time'
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
                // If text looks like Gregorian date (contains month abbreviation like Dec, Jan, etc.)
                // then it was updated by Jira and needs re-conversion
                if (currentText.match(/\d{1,2}\/[A-Za-z]{3}\/\d{2}/)) {
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

            var text = $el.text().trim();

            // Debug: Log each element found
            logDebug('Found element with text: "' + text + '" | tag: ' + $el.prop('tagName') + ' | class: ' + $el.attr('class'));

            // Skip relative dates like "17 hours ago", "Just now", etc.
            if (text.match(/ago|now|yesterday|tomorrow|hours|minutes|seconds/i)) {
                logDebug('Skipped relative date: ' + text);
                return;
            }

            // Try to parse Jira date format (d/MMM/yy or dd/MMM/yy h:mm a)
            // Extract date part first (before any time)
            var datePart = text.split(/\s+\d{1,2}:/)[0].trim();
            var timePart = '';

            // Match time with AM/PM format (e.g., "7:11 PM" or "12:30 AM")
            var timeMatch = text.match(/\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
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
                var time24Match = text.match(/\s+(\d{1,2}:\d{2})(?!\s*[AP]M)/i);
                if (time24Match) {
                    timePart = ' ' + time24Match[1];
                }
            }

            var parsed = parseJiraDate(datePart);
            if (parsed) {
                var jDate = toJalaali(parsed.year, parsed.month, parsed.day);
                var persianText = formatPersianDate(jDate.jy, jDate.jm, jDate.jd) + timePart;

                // Save original for tooltip
                $el.attr('title', text + ' = ' + persianText);

                // Use HTML with proper RTL handling to prevent bidirectional text mixing
                // The LRM (Left-to-Right Mark) character helps separate the time from Persian text
                var lrm = '\u200E';  // Left-to-Right Mark
                var rlm = '\u200F';  // Right-to-Left Mark
                var displayText = formatPersianDate(jDate.jy, jDate.jm, jDate.jd);
                if (timePart) {
                    displayText = displayText + lrm + timePart;
                }

                $el.text(displayText);
                $el.data('pc-converted', true);
                $el.css({
                    'direction': 'rtl',
                    'unicode-bidi': 'embed'
                });

                logInfo('Converted date: ' + text + ' → ' + persianText);
                convertedCount++;
            } else {
                logDebug('Could not parse date: "' + text + '" (datePart: "' + datePart + '")');
            }
        });

        logInfo('View page dates converted: ' + convertedCount);
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
            '[class*="date-picker"]'
        ];

        // Remove old listener if exists
        if (window.pcCalendarCaptureListener) {
            document.removeEventListener('click', window.pcCalendarCaptureListener, true);
        }

        // Use CAPTURE phase (third param = true) to intercept BEFORE Jira's handlers
        window.pcCalendarCaptureListener = function (e) {
            var target = e.target;
            var $target = $(target);

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

            logInfo('Calendar button clicked! Checking context...');

            // Check if inside datesmodule (Jira Core inline edit) OR JSM Customer Portal date picker
            var $datesModule = $btn.closest('#datesmodule');
            var $jsmDatePicker = $btn.closest('.cv-request-create-container, .sd-date-picker, .cp-date-picker, .field-group, [class*="date-picker"], form');

            // Allow either Jira Core (datesmodule) or JSM (various containers)
            var isJiraCore = $datesModule.length > 0;
            var isJSM = $jsmDatePicker.length > 0;

            if (!isJiraCore && !isJSM) {
                logDebug('Not in recognized context (neither Jira Core nor JSM)');
                return;
            }

            logInfo('Context detected: ' + (isJiraCore ? 'Jira Core' : 'JSM Customer Portal'));

            // Find the associated input field
            var $container = $btn.closest('.editable-field, .inline-edit-fields, [data-type="date"], [data-type="datetime"], .field-group, .cv-date-picker, .sd-date-picker');
            if ($container.length === 0) {
                if (isJiraCore) {
                    $container = $datesModule.find('.editable-field:visible, .inline-edit-fields:visible').first();
                } else {
                    // JSM: find nearby input
                    $container = $btn.parent();
                }
            }

            // Try multiple selectors to find the input
            var $input = $container.find('input.datepicker-input, input[class*="date"], input[type="text"]').first();

            // JSM specific: look for input with id containing duedate or date
            if ($input.length === 0) {
                $input = $btn.parent().find('input[type="text"]').first();
            }
            if ($input.length === 0) {
                $input = $btn.siblings('input[type="text"]').first();
            }
            if ($input.length === 0) {
                // Try finding any visible date input in the form
                $input = $btn.closest('form').find('input[id*="duedate"], input[name*="date"], input.text.date-picker').first();
            }

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
            var isDateTime = inputValue.match(/\d{1,2}:\d{2}/) ||
                inputValue.match(/[AP]M/i) ||
                placeholder.match(/h:mm/i) ||
                $container.attr('data-type') === 'datetime';

            logDebug('Inline edit calendar: isDateTime=' + !!isDateTime + ', value=' + inputValue);

            // Show our Persian calendar
            setTimeout(function () {
                if (isDateTime) {
                    showPersianDateTimePickerForInlineEdit($, $btn, $input);
                } else {
                    showPersianCalendarForInlineEdit($, $btn, $input);
                }
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

        // Create popup
        var popup = $('<div class="pc-popup"></div>').appendTo('body');

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
            zIndex: 9999
        });

        function render() {
            var html = '<div class="pc-header">';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">&laquo;</button>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">&lsaquo;</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">&rsaquo;</button>';
            html += '<button type="button" class="pc-next-year" title="سال بعد">&raquo;</button>';
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

            popup.html(html);
        }

        function close() {
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
                var gregorianStr = formatJiraDate(gDate.gy, gDate.gm, gDate.gd);
                logInfo('Formatted Gregorian string: ' + gregorianStr);

                // Re-find the input field - try multiple strategies
                var $datesModule = $('#datesmodule');
                logInfo('datesmodule found: ' + ($datesModule.length > 0));

                var $activeInput = null;

                // Strategy 1: Find input#duedate directly (most reliable)
                $activeInput = $datesModule.find('input#duedate:visible').first();
                logInfo('Strategy 1 (input#duedate:visible): found ' + $activeInput.length);

                // Strategy 2: Find any visible text input in the dates module
                if ($activeInput.length === 0) {
                    $activeInput = $datesModule.find('input[type="text"]:visible').first();
                    logInfo('Strategy 2 (input[type="text"]:visible): found ' + $activeInput.length);
                }

                // Strategy 3: Look in editable-field for any input
                if ($activeInput.length === 0) {
                    $activeInput = $datesModule.find('.editable-field input:visible, .inline-edit-fields input:visible').first();
                    logInfo('Strategy 3 (.editable-field input:visible): found ' + $activeInput.length);
                }

                // Strategy 4: Use the original $input passed to this function
                if ($activeInput.length === 0) {
                    $activeInput = $input;
                    logInfo('Strategy 4 (original $input fallback): found ' + ($activeInput ? $activeInput.length : 0));
                }

                if (!$activeInput || $activeInput.length === 0) {
                    logError('NO INPUT FOUND! Cannot set value.');
                    close();
                    return;
                }

                logInfo('Found active input: id=' + $activeInput.attr('id') + ', name=' + $activeInput.attr('name') + ', class=' + $activeInput.attr('class'));
                logInfo('Current input value before change: ' + $activeInput.val());

                // Set value using multiple methods to ensure it works
                $activeInput.val(gregorianStr);
                if ($activeInput[0]) {
                    $activeInput[0].value = gregorianStr;
                    // Set the value attribute too
                    $activeInput.attr('value', gregorianStr);
                    // Also set using native setter
                    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call($activeInput[0], gregorianStr);
                }

                logInfo('Input value after setting: ' + $activeInput.val());

                // Define inputEl for event dispatching
                var inputEl = $activeInput[0];

                try {
                    var nativeInputEvent = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        data: gregorianStr
                    });
                    inputEl.dispatchEvent(nativeInputEvent);
                } catch (e) {
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                }

                inputEl.dispatchEvent(new Event('change', { bubbles: true }));

                // Also trigger jQuery events
                $activeInput.trigger('input').trigger('change');

                logInfo('Value set and events dispatched: ' + $activeInput.val());

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
                    $submitBtn = $datesModule.find('.inline-edit-fields button[type="submit"], .aui-icon-check, [class*="save"]').first();
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
                        inputEl.focus();

                        // Simulate pressing Enter
                        var enterEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        inputEl.dispatchEvent(enterEvent);

                        var enterUp = new KeyboardEvent('keyup', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true
                        });
                        inputEl.dispatchEvent(enterUp);

                        // Also trigger blur which sometimes triggers save
                        setTimeout(function () {
                            $activeInput.trigger('blur');
                            inputEl.blur();
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
            else if (target.hasClass('pc-today')) { selectedDate = { jy: todayJ.jy, jm: todayJ.jm, jd: todayJ.jd }; confirm(); }
            else if (target.hasClass('pc-clear')) { $input.val('').trigger('change'); close(); }
            else if (target.hasClass('pc-confirm')) { confirm(); }
            e.preventDefault();
            e.stopPropagation();
        });

        overlay.on('click', close);
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
        var popup = $('<div class="pc-popup"></div>').appendTo('body');

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

        popup.css({ position: 'absolute', top: topPos + 'px', left: leftPos + 'px', zIndex: 9999 });

        function render() {
            var html = '<div class="pc-header">';
            html += '<button type="button" class="pc-prev-year">&laquo;</button>';
            html += '<button type="button" class="pc-prev-month">&lsaquo;</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-next-month">&rsaquo;</button>';
            html += '<button type="button" class="pc-next-year">&raquo;</button>';
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
                var classes = 'pc-day' + (isSelected ? ' selected' : '') + (isToday ? ' today' : '');
                html += '<span class="' + classes + '" data-day="' + d + '">' + d + '</span>';
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
            html += '<button type="button" class="pc-confirm primary">تأیید</button>';
            html += '<button type="button" class="pc-today">الان</button>';
            html += '<button type="button" class="pc-clear">پاک کردن</button>';
            html += '</div>';

            popup.html(html);

            // Bind time selectors
            popup.find('.pc-hour').on('change', function () { selectedHour = parseInt($(this).val(), 10); });
            popup.find('.pc-minute').on('change', function () { selectedMinute = parseInt($(this).val(), 10); });
            popup.find('.pc-ampm').on('change', function () { selectedAmPm = $(this).val(); });
        }

        function close() { cleanupBlurPrevention(); popup.remove(); overlay.remove(); }

        function selectDay(day) { selectedDate = { jy: viewYear, jm: viewMonth, jd: day }; render(); }

        function confirm() {
            if (selectedDate) {
                var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                logInfo('Converting Shamsi to Gregorian: ' + selectedDate.jy + '/' + selectedDate.jm + '/' + selectedDate.jd + ' -> ' + gDate.gy + '/' + gDate.gm + '/' + gDate.gd);
                var gregorianStr = formatJiraDateTime(gDate.gy, gDate.gm, gDate.gd, selectedHour, selectedMinute, selectedAmPm);
                logInfo('Setting inline edit DateTime value (Gregorian): ' + gregorianStr);

                // Re-find the input field in case DOM has changed
                var $datesModule = $('#datesmodule');
                var $activeInput = $datesModule.find('.editable-field.active input[type="text"]:visible, .inline-edit-fields input[type="text"]:visible').first();

                if ($activeInput.length === 0) {
                    $activeInput = $datesModule.find('input.datepicker-input:visible, input[class*="date"]:visible').first();
                }

                if ($activeInput.length === 0) {
                    $activeInput = $input;
                }

                logInfo('Found active input for DateTime: ' + $activeInput.attr('id') + ' / ' + $activeInput.attr('class'));

                // Set value using multiple methods
                $activeInput.val(gregorianStr);
                if ($activeInput[0]) {
                    $activeInput[0].value = gregorianStr;
                    $activeInput.attr('value', gregorianStr);
                }

                // Trigger events
                var inputEl = $activeInput[0];
                try {
                    var nativeInputEvent = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        data: gregorianStr
                    });
                    inputEl.dispatchEvent(nativeInputEvent);
                } catch (e) {
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                }

                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                $activeInput.trigger('input').trigger('change');

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
                        inputEl.focus();
                        var enterEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        inputEl.dispatchEvent(enterEvent);

                        setTimeout(function () {
                            $activeInput.trigger('blur');
                            inputEl.blur();
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
            else if (target.hasClass('pc-clear')) { $input.val('').trigger('change'); close(); }
            else if (target.hasClass('pc-confirm')) { confirm(); }
            e.preventDefault();
            e.stopPropagation();
        });

        overlay.on('click', close);
        render();
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
                                var minStr = selectedDateTime.minute < 10 ? '0' + selectedDateTime.minute : '' + selectedDateTime.minute;
                                var timeStr = selectedDateTime.hour + ':' + minStr + ' ' + selectedDateTime.ampm;
                                $persian.val(formatPersianDate(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd) + ' ' + timeStr);

                                // Format Jira value (Gregorian with time) - dd/MMM/yy h:mm a
                                var gDate = toGregorian(selectedDateTime.jy, selectedDateTime.jm, selectedDateTime.jd);
                                var formattedDate = formatJiraDateTime(gDate.gy, gDate.gm, gDate.gd, selectedDateTime.hour, selectedDateTime.minute, selectedDateTime.ampm);
                                $original.val(formattedDate);
                                logInfo('DateTime saved to original input: ' + formattedDate);
                                $original.trigger('change').trigger('input').trigger('blur');
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
                                $original.trigger('change').trigger('input').trigger('blur');
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
            initInlineEditCalendar($);
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
