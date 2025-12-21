# Jira Persian Calendar Plugin

This is a custom Jira plugin designed to integrate a **Persian (Jalali/Shamsi) Calendar** into Jira's web interface. It replaces the default Gregorian calendar picker with a Persian one while ensuring all dates are stored in the database in standard Gregorian format for full compatibility with Jira's core functionality.

## 🌟 Features

*   **Persian Calendar UI**: Replaces the standard date picker with a fully functional Persian calendar.
*   **Inline Edit Support**: Seamlessly integrates with Jira's inline edit functionality (clicking the pencil icon or the field value).
    *   Intercepts clicks on the calendar icon within inline edit dialogs.
    *   Prevents Jira's native calendar from opening.
    *   Displays the Persian calendar popup instead.
*   **DateTime Support**: Handles both **Date-only** fields (e.g., Due Date) and **DateTime** fields (e.g., Time of Start) with a built-in time picker (Hour, Minute, AM/PM).
*   **Automatic Conversion**:
    *   **Display**: Converts Gregorian dates from the database to Persian for the user.
    *   **Save**: Converts selected Persian dates back to Gregorian format (`d/MMM/yy` or `dd/MMM/yy h:mm a`) before submitting to Jira.
*   **Jalaali Library**: Uses a lightweight JavaScript implementation for accurate date conversions.

## 🛠 Technical Details

### Key Files & Structure

*   **`src/main/resources/js/persian-calendar.js`**: The core of the plugin. This file contains:
    *   `initPersianCalendar()`: Main entry point.
    *   `initInlineEditCalendar()`: Sets up event listeners (using **capture phase**) to intercept clicks on calendar buttons before Jira's native handlers can react.
    *   `showPersianCalendarForInlineEdit()`: Renders the calendar popup.
    *   `toGregorian()` / `toJalaali()`: Date conversion logic.
    *   Mutation Observers: Monitors the DOM for changes (like opening inline edit dialogs) to re-attach listeners if needed.
*   **`src/main/resources/atlassian-plugin.xml`**: configuration file. Defines the web resources (CSS/JS) and contexts (e.g., `jira.view.issue`, `jira.edit.issue`).
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

This will generate a JAR file in the `target/` directory (e.g., `persian-calendar-plugin-10.3.24.jar`).

### Installation on Jira Server
1.  Copy the generated JAR file to the Jira plugins directory on your server:
    ```bash
    scp target/persian-calendar-plugin-x.x.x.jar root@your-jira-server:/var/atlassian/application-data/jira/plugins/installed-plugins/
    ```
2.  Restart the Jira service to load the new plugin (hot-reloading might not work for all changes):
    ```bash
    /opt/atlassian/jira/bin/stop-jira.sh
    sleep 5
    /opt/atlassian/jira/bin/start-jira.sh
    ```

## 📝 Version History

*   **v10.3.24**: Merged inline edit features to master.
*   **v10.3.23**: Fixed date format output to match Jira's expected Gregorian format (`d/MMM/yy`). Added detailed logging.
*   **v10.3.21**: Implemented **capture phase** event listeners to completely block Jira's native calendar in inline edit mode.
*   **v10.3.20**: Initial support for inline edit interception.

## 🤝 Contributing
1.  Use the `master` branch for the latest stable code.
2.  Create feature branches for new developments.
3.  Ensure `pom.xml` version is updated before merging.
