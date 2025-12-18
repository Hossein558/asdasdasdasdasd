/**
 * Persian Calendar Integration for Jira
 * Replaces the default Gregorian date picker with Persian/Shamsi calendar
 * Stores data in Gregorian format
 */

(function () {
    'use strict';

    // Wait for AJS and jQuery
    function waitForJira(callback) {
        if (typeof AJS !== 'undefined' && AJS.$) {
            callback(AJS.$);
        } else if (typeof jQuery !== 'undefined') {
            callback(jQuery);
        } else {
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
        var parts = dateStr.trim().split('/');
        if (parts.length !== 3) return null;
        var d = parseInt(parts[0], 10);
        var mStr = parts[1];
        var y = parseInt(parts[2], 10);
        var m = GREGORIAN_MONTHS.indexOf(mStr);
        if (m === -1) return null;
        if (y < 100) y += 2000;
        return { year: y, month: m + 1, day: d };
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
        if (document.getElementById('persian-calendar-styles')) return;

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
            '.pc-footer button.primary:hover { background: #0065ff; }'
        ].join('\n');

        var style = document.createElement('style');
        style.id = 'persian-calendar-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // Create and show Persian calendar popup
    function showPersianCalendar($input, $originalInput, onSelect) {
        var $existing = document.querySelector('.pc-popup');
        if ($existing) $existing.remove();
        var $overlay = document.querySelector('.pc-overlay');
        if ($overlay) $overlay.remove();

        var today = new Date();
        var todayJ = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());

        // Get current value
        var currentJDate = null;
        var currentVal = $originalInput.val ? $originalInput.val() : $originalInput.value;
        if (currentVal) {
            var gDate = parseJiraDate(currentVal);
            if (gDate) {
                currentJDate = toJalaali(gDate.year, gDate.month, gDate.day);
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

        // Position popup
        var inputEl = $input[0] || $input;
        var rect = inputEl.getBoundingClientRect();
        popup.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        popup.style.left = (rect.left + window.scrollX) + 'px';

        function render() {
            var html = '<div class="pc-header">';
            html += '<button type="button" class="pc-next-year" title="سال بعد">&raquo;</button>';
            html += '<button type="button" class="pc-next-month" title="ماه بعد">&rsaquo;</button>';
            html += '<span class="pc-title">' + PERSIAN_MONTHS[viewMonth - 1] + ' ' + viewYear + '</span>';
            html += '<button type="button" class="pc-prev-month" title="ماه قبل">&lsaquo;</button>';
            html += '<button type="button" class="pc-prev-year" title="سال قبل">&laquo;</button>';
            html += '</div>';

            html += '<div class="pc-weekdays">';
            for (var w = 6; w >= 0; w--) {
                html += '<span>' + PERSIAN_WEEKDAYS[w] + '</span>';
            }
            html += '</div>';

            html += '<div class="pc-days">';

            var gFirst = toGregorian(viewYear, viewMonth, 1);
            var firstDate = new Date(gFirst.gy, gFirst.gm - 1, gFirst.gd);
            var firstDayOfWeek = firstDate.getDay();
            // Convert to Saturday-based week (Saturday = 0)
            var persianFirstDay = (firstDayOfWeek + 1) % 7;

            var daysInMonth = jalaaliMonthLength(viewYear, viewMonth);

            // Empty cells (from right in RTL)
            for (var e = 0; e < (6 - persianFirstDay + 7) % 7; e++) {
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
            html += '<button type="button" class="pc-clear">پاک کردن</button>';
            html += '<button type="button" class="pc-today">امروز</button>';
            html += '<button type="button" class="pc-confirm primary">تأیید</button>';
            html += '</div>';

            popup.innerHTML = html;
        }

        function close() {
            popup.remove();
            overlay.remove();
        }

        function selectDay(day) {
            selectedDate = { jy: viewYear, jm: viewMonth, jd: day };
            render();
        }

        function confirm() {
            if (selectedDate) {
                onSelect(selectedDate);
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
                selectedDate = { jy: todayJ.jy, jm: todayJ.jm, jd: todayJ.jd };
                onSelect(selectedDate);
                close();
            } else if (target.classList.contains('pc-clear')) {
                onSelect(null);
                close();
            } else if (target.classList.contains('pc-confirm')) {
                confirm();
            }
            e.preventDefault();
            e.stopPropagation();
        });

        overlay.addEventListener('click', function () {
            close();
        });

        render();
    }

    // Initialize Persian calendar for date inputs
    function initPersianCalendar($) {
        addStyles();

        // Find all duedate inputs
        var selectors = [
            'input#duedate',
            'input[name="duedate"]',
            'input[id*="duedate"]'
        ];

        $(selectors.join(',')).each(function () {
            var $original = $(this);
            if ($original.data('pc-init')) return;
            $original.data('pc-init', true);

            // Hide original input
            $original.css('display', 'none');

            // Also hide calendar trigger
            $original.siblings('.aui-ss, .aui-date-picker, .icon-calendar, [class*="calendar"]').hide();
            $original.next().hide();

            // Create Persian input
            var $persian = $('<input type="text" class="text medium-field" readonly style="cursor:pointer; direction:rtl; text-align:right;">');
            $persian.attr('placeholder', 'انتخاب تاریخ');
            $original.after($persian);

            // Set initial value
            var currentVal = $original.val();
            if (currentVal) {
                var gDate = parseJiraDate(currentVal);
                if (gDate) {
                    var jDate = toJalaali(gDate.year, gDate.month, gDate.day);
                    $persian.val(formatPersianDate(jDate.jy, jDate.jm, jDate.jd));
                }
            }

            // Click handler
            $persian.on('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                showPersianCalendar($persian, $original, function (selectedDate) {
                    if (selectedDate) {
                        $persian.val(formatPersianDate(selectedDate.jy, selectedDate.jm, selectedDate.jd));
                        var gDate = toGregorian(selectedDate.jy, selectedDate.jm, selectedDate.jd);
                        $original.val(formatJiraDate(gDate.gy, gDate.gm, gDate.gd));
                        $original.trigger('change');
                    } else {
                        $persian.val('');
                        $original.val('');
                        $original.trigger('change');
                    }
                });
            });

            // Prevent original calendar from opening
            $original.off('click focus');
            $original.on('click focus', function (e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
        });
    }

    // Main initialization
    waitForJira(function ($) {
        console.log('[Persian Calendar] Initializing...');

        // Initial run
        setTimeout(function () {
            initPersianCalendar($);
        }, 500);

        // Re-run on AJAX content
        if (typeof JIRA !== 'undefined' && JIRA.bind) {
            JIRA.bind(JIRA.Events.NEW_CONTENT_ADDED, function () {
                setTimeout(function () {
                    initPersianCalendar($);
                }, 200);
            });
        }

        // Also observe DOM changes
        var observer = new MutationObserver(function (mutations) {
            var shouldInit = false;
            mutations.forEach(function (mutation) {
                if (mutation.addedNodes.length > 0) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        if (node.nodeType === 1 && (node.id === 'duedate' || (node.querySelector && node.querySelector('#duedate, [name="duedate"]')))) {
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
    });

})();
