# Jira Persian Calendar Plugin

This is a custom Jira plugin designed to integrate a **Persian (Jalali/Shamsi) Calendar** into Jira's web interface. It replaces the default Gregorian calendar picker with a Persian one while ensuring all dates are stored in the database in standard Gregorian format for full compatibility with Jira's core functionality.

## 🌟 Features

*   **Persian Calendar UI**: Replaces the standard date picker with a fully functional Persian calendar.
*   **Inline Edit Support**: Seamlessly integrates with Jira's inline edit functionality (clicking the pencil icon or the field value).
    *   Intercepts clicks on the calendar icon within inline edit dialogs.
    *   Prevents Jira's native calendar from opening.
    *   Displays the Persian calendar popup instead.
*   **DateTime Support**: Handles both **Date-only** fields (e.g., Due Date) and **DateTime** fields (e.g., Time of Start) with a built-in time picker (Hour, Minute, AM/PM).
*   **Activity Stream Persian Time** *(v11.4.0)*: Converts relative timestamps to Persian (e.g., "15 minutes ago" → "۱۵ دقیقه قبل").
*   **Issue Search Persian Dates** *(v11.4.0)*: Displays dates in Issue Navigator in Persian format `1404/11/05` (10 characters).
*   **24-Hour DateTime Format** *(v11.4.0)*: DateTime fields display in 24-hour format like `1404/11/05 13:40`.
*   **JSM Customer Portal Support**: Works on Jira Service Management customer portal pages.
*   **Dynamic Date Format Detection**: Automatically reads Jira's configured date format via REST API.
*   **Smart Date Parser**: Supports multiple date formats including `d/MMM/yy`, `yyyy-MM-dd`, `MM/dd/yyyy`, and more.
*   **Automatic Conversion**:
    *   **Display**: Converts Gregorian dates from the database to Persian for the user.
    *   **Save**: Converts selected Persian dates back to Gregorian format before submitting to Jira.
*   **Jalaali Library**: Uses a lightweight JavaScript implementation for accurate date conversions.
*   **JXL Support**: Compatible with **JXL (Jira Excel-like Issue Editor)** plugin.
*   **Unified Arrow Layout**: Consistent navigation arrows in both Date and DateTime pickers:
    *   `<<` سال قبل | `<` ماه قبل | عنوان | `>` ماه بعد | `>>` سال بعد

## 🔌 REST API

The plugin exposes a REST endpoint to retrieve Jira's date format settings:

```
GET /rest/persian-calendar/1.0/date-formats
```

**Response:**
```json
{
  "dateFormat": "d/MMM/yy",
  "dateTimeFormat": "dd/MMM/yy h:mm a",
  "dateFormatJS": "%e/%b/%y",
  "dateTimeFormatJS": "%e/%b/%y %I:%M %p"
}
```

## 🛠 Technical Details

### Key Files & Structure

*   **`src/main/resources/js/persian-calendar.js`**: The core of the plugin. This file contains:
    *   `initPersianCalendar()`: Main entry point.
    *   `initInlineEditCalendar()`: Sets up event listeners (using **capture phase**) to intercept clicks on calendar buttons before Jira's native handlers can react.
    *   `showPersianCalendarForInlineEdit()`: Renders the calendar popup.
    *   `toGregorian()` / `toJalaali()`: Date conversion logic.
    *   `parseJiraDate()`: Smart date parser with multi-format support.
    *   Mutation Observers: Monitors the DOM for changes.
*   **`src/main/java/ir/atlassian/jira/plugins/rest/DateFormatResource.java`**: REST API for date formats.
*   **`src/main/resources/atlassian-plugin.xml`**: Configuration file. Defines the web resources (CSS/JS) and contexts.
*   **`pom.xml`**: Maven project configuration and dependencies.

### How Inline Edit Interception Works
Jira's inline edit fields are dynamically loaded. To prevent the native calendar from conflicting:
1.  We attach a `click` event listener to `document` with `useCapture: true`.
2.  This listener detects clicks on `.aui-iconfont-calendar` elements.
3.  If the click is within an inline edit container, we call `e.stopPropagation()` and `e.stopImmediatePropagation()` to block Jira's default handlers.
4.  We then manually trigger our own Persian Calendar popup.

## 🚀 Build & Deployment

### Prerequisites
*   Java JDK 11 (Recommended for Jira 9 compatibility) or JDK 17
*   Maven (Wrapper included in project)
*   Node.js (Provides `npx` required for Javascript obfuscation during build)

### Building the Plugin
You can build the project using the included Maven Wrapper:

```bash
# On Windows
.\mvnw.cmd clean package

# On Linux/Mac
./mvnw clean package
```

This will generate a JAR file in the `target/` directory (e.g., `persian-calendar-plugin-10.4.12.jar`).

### Installation on Jira Server
1.  Copy the generated JAR file to the Jira plugins directory on your server:
    ```bash
    scp target/persian-calendar-plugin-x.x.x.jar root@your-jira-server:/var/atlassian/application-data/jira/plugins/installed-plugins/
    ```
2.  Restart the Jira service to load the new plugin:
    ```bash
    /opt/atlassian/jira/bin/stop-jira.sh
    sleep 5
    /opt/atlassian/jira/bin/start-jira.sh
    ```

## 🔐 License System

The plugin uses a custom license system to validate usage. Customers must obtain a license key to activate the plugin.

### License Format
```
[TYPE]-[SERVER_ID]-[EXPIRY_DATE]-[SIGNATURE]
```
Example: `F-A1B2C3D4-20261231-8F3E2A1B...` (Full 512-hex string)

| Part | Description |
|:---|:---|
| **TYPE** | `F` = Full License, `T` = Trial License |
| **SERVER_ID** | Unique 8-character ID from customer's Jira installation |
| **EXPIRY_DATE** | Format: `YYYYMMDD` |
| **SIGNATURE** | RSA-2048 SHA-256 signature (512 hex chars) |

### Customer Flow

1. **Customer gets Server ID**: Navigate to `https://<jira-host>/plugins/servlet/persian-calendar/license`
2. **Customer sends Server ID**: The customer sends their Jira Server ID (e.g., `BPT3-4S1P-7QGE-5M9S`) to you.3. **You generate license**: Use the License Generator tool (see below)
4. **Customer activates**: Customer enters the license key in the same page and clicks "Activate"

### Generating a License

Use the `LicenseGeneratorStandalone.java` tool in the `tools/` directory along with your `private_key.pem`:

```bash
cd tools
java LicenseGeneratorStandalone.java private_key.pem
```

Interactive prompts:
```
????????????????????????????????????????????????????
?   Persian Calendar RSA License Generator         ?
?   DesktopCenter.ir                               ?
????????????????????????????????????????????????????

Enter Server ID: BPT3-4S1P-7QGE-5M9S
License Type (F=Full, T=Trial): F
Expiry Date (YYYY-MM-DD): 2026-12-31

Generated License Key:

F-BPT3-4S1P-20261231-741B189BE52D8D9A5B794965F3FD8AF09745FE5C3C4F954212DBE0347F16ADA... (512 Hex characters)

Type: Full
Server ID: BPT3-4S1P-7QGE-5M9S
Expires: 2026-12-31
```

### License Admin Panel

Customers access the license panel at:
```
/plugins/servlet/persian-calendar/license
```

Features:
- **Server ID Display**: Shows the unique Server ID for the installation
- **License Activation Form**: Enter and activate license keys
- **Status Display**: Shows current license status (Active/Inactive/Expired)

### Grace Period
- When a **Full license** expires, there is a **10-day grace period** before the calendar is disabled
- **Trial licenses have NO grace period** - they are disabled immediately upon expiration
- During grace period, a warning message is shown to the user

### REST API Endpoints

| Endpoint | Method | Description |
|:---|:---|:---|
| `/rest/persian-calendar/1.0/license/status` | GET | Get license status (used by JavaScript) |
| `/rest/persian-calendar/1.0/license/server-id` | GET | Get Jira Server ID || `/rest/persian-calendar/1.0/license/activate` | POST | Activate a license key |
| `/rest/persian-calendar/1.0/license/current` | GET | Get current license (masked) |

**Example Response from `/license/status`:**
```json
{
  "status": "VALID",
  "enabled": true,
  "message": "لایسنس آزمایشی - 30 روز باقیمانده",
  "daysRemaining": 30,
  "type": "TRIAL",
  "expiryDate": "2026-02-01"
}
```

### Database Storage

License data is stored in Jira's property tables. To query:

```sql
-- Find license key
SELECT pe.id, pe.property_key, ps.propertyvalue 
FROM propertyentry pe
JOIN propertystring ps ON pe.id = ps.id
WHERE pe.property_key LIKE '%persian-calendar%license%';

-- Find all plugin settings
SELECT pe.id, pe.property_key, ps.propertyvalue 
FROM propertyentry pe
JOIN propertystring ps ON pe.id = ps.id
WHERE pe.property_key LIKE '%persian-calendar%';
```

### Security Architecture (v11.3.x+)

The plugin employs a multi-layered security approach:

#### 1. Unique Server Identification
The plugin uses the standard **Jira Server ID** (`JiraLicenseManager.getServerId()`) to bind licenses. This ensures the license is tied specifically to the customer's Jira instance.

> **Note**: Unlike older versions of this plugin, the Server ID is no longer a custom hardware hash. It is the exact same Server ID found in Jira's System Information page.

#### 2. Defense-in-Depth
| Layer | Mechanism | Protection Against |
|:---|:---|:---|
| **Build-Time** | **JavaScript Obfuscation** | Reverse engineering & understanding code logic |
| **Runtime (JS)** | **Integrity Check** | Tampering with client-side code (`persian-calendar.js`) |
| **Runtime (Java)** | **IntegrityChecker.java** | Tampering with plugin JAR files |
| **License** | **Digital Signature** | Forging license keys |

#### 3. Obfuscation & Hardening
- **JavaScript**: Obfuscated during build using `javascript-obfuscator` (variables renamed, control flow flattened, strings encoded).
- **Java**: Self-verification code embedded to detect class modification.

#### 4. Hardcoded Integrity Hashes (Important Development Rule)

**FUTURE DEVELOPMENT RULE: Because we have hardcoded these hashes to lock down the security, if you or your team ever legitimately edit `js/persian-calendar.js` or change the plugin's version number in the `pom.xml` (which affects `atlassian-plugin.xml`), you will need to recalculate the SHA-256 hashes for those files and update the `EXPECTED_XML_HASH` and `EXPECTED_JS_HASH` variables in `IntegrityChecker.java` before building the final JAR.**

**How to calculate the hashes:**
1. Generate the final files using Maven: `.\mvnw clean process-resources`
2. Run these PowerShell commands to get the hashes from the compiled target folder:
   - `(Get-FileHash -Algorithm SHA256 target\classes\atlassian-plugin.xml).Hash.ToLower()`
   - `(Get-FileHash -Algorithm SHA256 target\classes\js\persian-calendar.js).Hash.ToLower()`
3. Copy the generated lowercase hashes and update the `EXPECTED_XML_HASH` and `EXPECTED_JS_HASH` string constants in `src/main/java/ir/atlassian/jira/plugins/security/IntegrityChecker.java` (around line 28).

---

## 📝 Version History

*   **v11.4.11**: **ScriptRunner Full English JS Date Support** - Major compatibility update:
    *   **Full JS-Style English Date Parsing**: Automatically parses and converts full JavaScript-style English date strings (such as `Sat May 23 2026 00:33:50 GMT+0330 (Iran Standard Time)`) generated by plugins like **Adaptavist ScriptRunner for JIRA** into localized Shamsi dates (e.g., `شنبه ۲ خرداد ۱۴۰۵ ساعت ۰۰:۳۳:۵۰ (GMT+03:30 - به وقت ایران)`).
    *   **Universal Mutation Observer Integration**: Wires conversion into dynamic AJAX page updates (`NEW_CONTENT_ADDED` and custom observers), ensuring instant translation on ScriptRunner log renders and execution console.
*   **v11.4.10**: **JXL Upload Fix & Advanced Roadmaps Grid Save Fixes** - Major compatibility release:
    *   **JXL Choose File Hijack Resolved**: Restricts JXL input interception exclusively to `<input type="text">` and `<textarea>` whose values match a date pattern. Restores standard browser file selection behavior on "Choose file" buttons.
    *   **React Grid Save Fixes**: Implements dynamic prototype traversal using `Object.getPrototypeOf()` to fetch value setters, eliminating the `TypeError: Illegal invocation` error on custom inputs. Sends a structured event payload matching Atlaskit's schema to resolve `undefined.split` errors.
    *   **Robust Navigation Targeting**: Implements 5-layered fallback selector strategy to locate React month navigation elements accurately in dynamically rendered Atlaskit grids.
*   **v11.4.9**: Support dynamic Persian date conversion in Audit Log and System Info pages, and added comprehensive dynamic license support.
*   **v11.4.0**: **Persian Date & Time Enhancement** - Added comprehensive Persian display support:
    *   **Activity Stream**: Converts relative timestamps (e.g., "15 minutes ago" → "۱۵ دقیقه قبل") for comments, worklogs, and history.
    *   **Issue Search**: Displays dates in Issue Navigator in Persian format `1404/11/05`.
    *   **Time Spent / Durations**: Converts duration fields (e.g., "1h 30m" → "۱ ساعت ۳۰ دقیقه") in Issue Details and Work Logs.
    *   **DateTime Format**: Displays DateTime fields in 24-hour format (e.g., `1404/11/05 13:40`).
    *   **History Tab**: Supports standard Jira history format (handles "Original:" and "New:" prefixes).
*   **v11.3.1**: **Security Hardening** - Added **Build-time JavaScript Obfuscation**. JS files are now obfuscated inside the JAR to prevent reverse engineering.
*   **v11.3.0**: **Integrity Checks** - Added `IntegrityChecker` for Java (self-verification) and JavaScript (runtime integrity check).
*   **v11.2.3**: **Enhanced Server ID** - Switched back to standard Jira Server ID to simplify licensing for customers running Data Center nodes.*   **v11.2.2**: **REST API Fix** - Use `ComponentAccessor` for `PluginSettingsFactory` to fix license status check.
*   **v11.2.1**: **Grace Period Fix** - Trial licenses expire immediately (no grace period). Removed license cache for immediate updates.
*   **v11.2.0**: **License Enforcement** - Plugin now fails-closed (disabled) if no valid license is present.
*   **v11.1.0**: Added **License Admin Panel** - Customers can view Server ID and activate licenses via `/plugins/servlet/persian-calendar/license`.
*   **v11.0.0**: **Rebranding to DesktopCenter.ir** - Updated vendor info, added premium orange plugin icon.
*   **v10.6.9**: Unified Orange UI - All buttons now use vibrant orange theme, fixed header layout for long months.
*   **v10.6.5**: Advanced Holidays - Occasions, tooltips, data extended to 1407.
*   **v10.6.2**: Replaced navigation arrows with text labels ("سال قبل", "ماه قبل", etc.) for better usability in all pickers.
*   **v10.6.1**: Fixed DateTime detection regression in Jira Search (Basic Search). Improved detection of Created/Updated/Resolved fields.
*   **v10.6.0**: Added **Custom License System** with HMAC-SHA256 validation, Server ID binding, and 10-day grace period.
*   **v10.5.17**: Swapped functionality of Next/Prev buttons (Right button now goes to Previous, Left goes to Next) as per request.

## 🤝 Contributing
1.  Use the `master` branch for the latest stable code.
2.  Create feature branches for new developments.
3.  Ensure `pom.xml` version is updated before merging.

## 📜 License

This plugin is commercial software provided by [DesktopCenter.ir](https://desktopcenter.ir/).
