# Jira Persian Calendar Plugin

This is a custom Jira plugin designed to integrate a **Persian (Jalali/Shamsi) Calendar** into Jira's web interface. It replaces the default Gregorian calendar picker with a Persian one while ensuring all dates are stored in the database in standard Gregorian format for full compatibility with Jira's core functionality.

## 🌟 Features

*   **Persian Calendar UI**: Replaces the standard date picker with a fully functional Persian calendar.
*   **Inline Edit Support**: Seamlessly integrates with Jira's inline edit functionality (clicking the pencil icon or the field value).
    *   Intercepts clicks on the calendar icon within inline edit dialogs.
    *   Prevents Jira's native calendar from opening.
    *   Displays the Persian calendar popup instead.
*   **DateTime Support**: Handles both **Date-only** fields (e.g., Due Date) and **DateTime** fields (e.g., Time of Start) with a built-in time picker (Hour, Minute, AM/PM).
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
*   Java JDK 17 (or compatible version for your Jira instance)
*   Maven (Wrapper included in project)

### Building the Plugin
You can build the project using the included Maven Wrapper:

```bash
# On Windows
.\mvnw.cmd clean package -DskipTests

# On Linux/Mac
./mvnw clean package -DskipTests
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
Example: `F-A1B2C3D4-20261231-8F3E2A1B`

| Part | Description |
|:---|:---|
| **TYPE** | `F` = Full License, `T` = Trial License |
| **SERVER_ID** | Unique 8-character ID from customer's Jira installation |
| **EXPIRY_DATE** | Format: `YYYYMMDD` |
| **SIGNATURE** | HMAC-SHA256 signature (first 8 hex chars) |

### Customer Flow

1. **Customer gets Server ID**: Navigate to `https://<jira-host>/plugins/servlet/persian-calendar/license`
2. **Customer sends Server ID**: The customer sends the 8-character Server ID to you
3. **You generate license**: Use the License Generator tool (see below)
4. **Customer activates**: Customer enters the license key in the same page and clicks "Activate"

### Generating a License

Use the `LicenseGenerator.java` tool in the `tools/` directory:

```bash
# Compile the generator
cd tools
javac LicenseGenerator.java

# Run the generator
java LicenseGenerator
```

Interactive prompts:
```
╔══════════════════════════════════════════╗
║   Persian Calendar License Generator     ║
╚══════════════════════════════════════════╝

Enter Server ID (8 chars, e.g., A1B2C3D4): A1B2C3D4
License Type (F=Full, T=Trial): F
Expiry Date (YYYY-MM-DD): 2026-12-31

════════════════════════════════════════════
Generated License Key:

  F-A1B2C3D4-20261231-8F3E2A1B

════════════════════════════════════════════
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
| `/rest/persian-calendar/1.0/license/server-id` | GET | Get Server ID hash |
| `/rest/persian-calendar/1.0/license/activate` | POST | Activate a license key |
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
Server ID is calculated using multiple factors including a **unique installation UUID**:
```
Server ID = SHA256(jira.home + hostname + OS + InstallationUUID)
```
- **InstallationUUID**: A 16-char unique ID generated once per installation and stored in the database.
- Prevents license copying between servers even with identical hostnames.

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

---

## 📝 Version History

*   **v11.3.1**: **Security Hardening** - Added **Build-time JavaScript Obfuscation**. JS files are now obfuscated inside the JAR to prevent reverse engineering.
*   **v11.3.0**: **Integrity Checks** - Added `IntegrityChecker` for Java (self-verification) and JavaScript (runtime integrity check).
*   **v11.2.3**: **Enhanced Server ID** - Added unique **Installation UUID** to Server ID calculation to prevent license cloning.
*   **v11.2.2**: **REST API Fix** - Use `ComponentAccessor` for `PluginSettingsFactory` to fix license status check.
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
