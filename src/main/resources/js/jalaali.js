/**
 * Jalaali (Persian/Shamsi) Calendar Conversion Library
 * Based on jalaali-js by Behrang Noroozinia
 * https://github.com/jalaali/jalaali-js
 */

var jalaali = (function () {

    /**
     * Converts a Gregorian date to Jalaali.
     * @param {number|Date} gy - Gregorian year, or a standard JavaScript Date object.
     * @param {number} [gm] - Gregorian month (1-12).
     * @param {number} [gd] - Gregorian day of the month (1-31).
     * @returns {Object} An object containing the Jalaali year (jy), month (jm), and day (jd).
     */
    function toJalaali(gy, gm, gd) {
        if (Object.prototype.toString.call(gy) === '[object Date]') {
            gd = gy.getDate();
            gm = gy.getMonth() + 1;
            gy = gy.getFullYear();
        }
        return d2j(g2d(gy, gm, gd));
    }

    /**
     * Converts a Jalaali date to Gregorian.
     * @param {number} jy - Jalaali year.
     * @param {number} jm - Jalaali month (1-12).
     * @param {number} jd - Jalaali day of the month (1-31).
     * @returns {Object} An object containing the Gregorian year (gy), month (gm), and day (gd).
     */
    function toGregorian(jy, jm, jd) {
        return d2g(j2d(jy, jm, jd));
    }

    /**
     * Checks whether a Jalaali date is valid or not.
     * @param {number} jy - Jalaali year.
     * @param {number} jm - Jalaali month (1-12).
     * @param {number} jd - Jalaali day of the month.
     * @returns {boolean} True if the date is a valid Jalaali date, false otherwise.
     */
    function isValidJalaaliDate(jy, jm, jd) {
        return jy >= -61 && jy <= 3177 &&
            jm >= 1 && jm <= 12 &&
            jd >= 1 && jd <= jalaaliMonthLength(jy, jm);
    }

    /**
     * Determines if a given Jalaali year is a leap year.
     * @param {number} jy - Jalaali year.
     * @returns {boolean} True if the year is a leap year.
     */
    function isLeapJalaaliYear(jy) {
        return jalCal(jy).leap === 0;
    }

    /**
     * Returns the number of days in a given month of a Jalaali year.
     * @param {number} jy - Jalaali year.
     * @param {number} jm - Jalaali month (1-12).
     * @returns {number} The number of days in the month (29, 30, or 31).
     */
    function jalaaliMonthLength(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        if (isLeapJalaaliYear(jy)) return 30;
        return 29;
    }

    /**
     * Determines if the Jalaali (Persian) year is a leap year (366 days)
     * or a common year (365 days), and finds the day in March (Gregorian
     * calendar) of the first day of the Jalaali year.
     *
     * @param {number} jy - Jalaali calendar year (-61 to 3177).
     * @returns {Object} An object containing:
     *   - `leap`: number of years since the last leap year (0 means it is a leap year).
     *   - `gy`: Gregorian year of the beginning of the Jalaali year.
     *   - `march`: the March day of Farvardin the 1st.
     */
    function jalCal(jy) {
        var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
            1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178],
            bl = breaks.length,
            gy = jy + 621,
            leapJ = -14,
            jp = breaks[0],
            jm,
            jump,
            leap,
            leapG,
            march,
            n,
            i;

        if (jy < jp || jy >= breaks[bl - 1])
            throw new Error('Invalid Jalaali year ' + jy);

        for (i = 1; i < bl; i += 1) {
            jm = breaks[i];
            jump = jm - jp;
            if (jy < jm)
                break;
            leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
            jp = jm;
        }
        n = jy - jp;

        leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
        if (mod(jump, 33) === 4 && jump - n === 4)
            leapJ += 1;

        leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;

        march = 20 + leapJ - leapG;

        if (jump - n < 6)
            n = n - jump + div(jump + 4, 33) * 33;
        leap = mod(mod(n + 1, 33) - 1, 4);
        if (leap === -1) {
            leap = 4;
        }

        return {
            leap: leap,
            gy: gy,
            march: march
        };
    }

    /**
     * Converts a date of the Jalaali calendar to the Julian Day number.
     *
     * @param {number} jy - Jalaali year.
     * @param {number} jm - Jalaali month (1-12).
     * @param {number} jd - Jalaali day (1-31).
     * @returns {number} The Julian Day number.
     */
    function j2d(jy, jm, jd) {
        var r = jalCal(jy);
        return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
    }

    /**
     * Converts the Julian Day number to a date in the Jalaali calendar.
     *
     * @param {number} jdn - Julian Day number.
     * @returns {Object} An object containing the Jalaali year (jy), month (jm), and day (jd).
     */
    function d2j(jdn) {
        var gy = d2g(jdn).gy,
            jy = gy - 621,
            r = jalCal(jy),
            jdn1f = g2d(gy, 3, r.march),
            jd,
            jm,
            k;

        k = jdn - jdn1f;
        if (k >= 0) {
            if (k <= 185) {
                jm = 1 + div(k, 31);
                jd = mod(k, 31) + 1;
                return {
                    jy: jy,
                    jm: jm,
                    jd: jd
                };
            } else {
                k -= 186;
            }
        } else {
            jy -= 1;
            k += 179;
            if (r.leap === 1)
                k += 1;
        }
        jm = 7 + div(k, 30);
        jd = mod(k, 30) + 1;
        return {
            jy: jy,
            jm: jm,
            jd: jd
        };
    }

    /**
     * Calculates the Julian Day number from Gregorian or Julian calendar dates.
     * This integer number corresponds to the noon of the date (i.e. 12 hours of Universal Time).
     *
     * @param {number} gy - Gregorian year.
     * @param {number} gm - Gregorian month (1-12).
     * @param {number} gd - Gregorian day of the month.
     * @returns {number} The Julian Day number.
     */
    function g2d(gy, gm, gd) {
        var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
            div(153 * mod(gm + 9, 12) + 2, 5) +
            gd - 34840408;
        d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
        return d;
    }

    /**
     * Calculates Gregorian and Julian calendar dates from the Julian Day number.
     *
     * @param {number} jdn - Julian Day number.
     * @returns {Object} An object containing the Gregorian year (gy), month (gm), and day (gd).
     */
    function d2g(jdn) {
        var j,
            i,
            gd,
            gm,
            gy;
        j = 4 * jdn + 139361631;
        j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
        i = div(mod(j, 1461), 4) * 5 + 308;
        gd = div(mod(i, 153), 5) + 1;
        gm = mod(div(i, 153), 12) + 1;
        gy = div(j, 1461) - 100100 + div(8 - gm, 6);
        return {
            gy: gy,
            gm: gm,
            gd: gd
        };
    }

    /**
     * Utility function for integer division.
     *
     * @param {number} a - Dividend.
     * @param {number} b - Divisor.
     * @returns {number} The integer quotient.
     */
    function div(a, b) {
        return ~~(a / b);
    }

    /**
     * Utility function for integer modulo.
     *
     * @param {number} a - Dividend.
     * @param {number} b - Divisor.
     * @returns {number} The integer remainder.
     */
    function mod(a, b) {
        return a - ~~(a / b) * b;
    }

    // Public API
    return {
        toJalaali: toJalaali,
        toGregorian: toGregorian,
        isValidJalaaliDate: isValidJalaaliDate,
        isLeapJalaaliYear: isLeapJalaaliYear,
        jalaaliMonthLength: jalaaliMonthLength,
        j2d: j2d,
        d2j: d2j,
        g2d: g2d,
        d2g: d2g
    };
})();

// Make it available globally
if (typeof window !== 'undefined') {
    window.jalaali = jalaali;
}
