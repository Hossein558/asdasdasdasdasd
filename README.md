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

## 📝 Version History

*   **v10.6.2**: Replaced navigation arrows with text labels ("سال قبل", "ماه قبل", etc.) for better usability in all pickers.
*   **v10.6.1**: Fixed DateTime detection regression in Jira Search (Basic Search). Improved detection of Created/Updated/Resolved fields.
*   **v10.6.0**: Added **Custom License System** with HMAC-SHA256 validation, Server ID binding, and 10-day grace period.
*   **v10.5.17**: Swapped functionality of Next/Prev buttons (Right button now goes to Previous, Left goes to Next) as per request.
*   **v10.5.17**: Confirmed compatibility with JXL (Jira Excel-like Issue Editor).
*   **v10.4.12**: Fixed unified arrow layout for both Date and DateTime pickers (سال قبل → ماه قبل → عنوان → ماه بعد → سال بعد).
*   **v10.4.1**: Added smart date parser with multi-format support.
*   **v10.4.0**: Added REST API for dynamic date format detection.
*   **v10.3.34**: Added JSM Customer Portal support.
*   **v10.3.28**: Fixed inline edit blur prevention for DateTime fields.
*   **v10.3.24**: Merged inline edit features to master.
*   **v10.3.23**: Fixed date format output to match Jira's expected Gregorian format.
*   **v10.3.21**: Implemented capture phase event listeners for inline edit interception.

## 🤝 Contributing
1.  Use the `master` branch for the latest stable code.
2.  Create feature branches for new developments.
3.  Ensure `pom.xml` version is updated before merging.
