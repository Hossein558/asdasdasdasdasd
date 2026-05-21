# Walkthrough: Persian Calendar Bug Fixes & Version Bump (v11.4.9)

We have successfully resolved critical JavaScript errors, styling overlays, input targeting issues, and clean logging for the Persian Calendar Plugin on **Jira 11** servers. The plugin has been compiled under version **11.4.9** to completely bypass old browser and OSGi container caches.

---

## 🔍 Detailed Root Cause Analysis & Technical Solutions

### 1. Undefined `$container` ReferenceError Fixed
* **The Problem**: In version 11.4.8, when clicking the calendar icon inside search panels or dialogue menus, a fatal `ReferenceError: $container is not defined` was thrown in the browser console. This silent crash halted JavaScript execution completely, preventing the Persian calendar dialog from opening.
* **The Fix**: In `persian-calendar.js` (lines 2107-2108), we replaced the reference to the undefined `$container` variable with a highly robust traversal check:
  ```javascript
  ($input.closest('[data-type]').length > 0 && $input.closest('[data-type]').attr('data-type') === 'datetime') ||
  ($input.attr('data-type') === 'datetime') ||
  ```
  This cleanly resolves the parent container element type check, eliminating the ReferenceError entirely.

### 2. Proximity Input Targeting (Range Search Date Pickers)
* **The Problem**: In Jira 11's Issue Navigator search filters, choosing the **Between** query mode exposes two date input fields (Start Date and End Date). When trying to populate the second date field, clicking the calendar icon incorrectly targeted the first field, or populated both fields with the same value.
* **The Fix**: We updated the search criteria targeting and proximity matching algorithm in `findClosestInput`. It now bypasses non-text range inputs (such as radio buttons, check-boxes, or hidden inputs) and matches the correct field via trigger association (`dateBetweenStart` and `dateBetweenEnd` respectively) with precise context checking.

### 3. Z-Index and CSS Panel Overlap Resolution
* **The Problem**: The Persian Calendar popup was rendered behind the Jira basic search query-criteria drop-down or dialog modal overlay, rendering the calendar invisible or completely unusable.
* **The Fix**: We raised the `z-index` of the Persian calendar popups (`.pc-popup`, `.pc-datepicker-container`) in the CSS styles block to `2000000000+` (over 2 billion), guaranteeing that the calendar will always float safely on top of all Jira Core, JSM, or AUI dialog layers.

### 4. Consolidated Duplicate Version Logs
* **The Problem**: The console was printing duplicate messages such as `Version 11.4.8 loaded` followed by `Version 11.4.6 loaded` due to a duplicate inner script block in older versions.
* **The Fix**: We removed the duplicate declaration of `var PC_VERSION = '11.4.6'` and its corresponding logger, resulting in a single clean version line (`v11.4.9`) inside the browser console.

### 5. Automated Jakarta EE (Jira 11) Compilation
* **The Problem**: Jira 11 operates inside the **Jakarta EE** (`jakarta.*`) namespace, which is completely incompatible with older Java EE (`javax.*`) plugins.
* **The Fix**: Using Maven's Eclipse Transformer plugin, our compilation script automatically processes package imports and compiles a robust **Jakarta-compatible JAR** file.

---

## 🛠️ Work Summary

1. **JavaScript Bug Fixes (`persian-calendar.js`)**:
   * Removed `$container` ReferenceError by replacing it with `$input.closest('[data-type]')`.
   * Cleared old duplicate `PC_VERSION` blocks and log outputs.
   * Version bumped all JS internal definitions to `'11.4.9'`.
2. **POM Version Alignment (`pom.xml`)**:
   * Updated `<version>11.4.8</version>` to `<version>11.4.9</version>`.
3. **Maven Clean Compilation**:
   * Ran `.\mvnw.cmd clean package` successfully.
   * Generated the Jakarta EE (`-jakarta.jar`) artifact under the new version `11.4.9`.

---

## 📦 Output Artifacts

Both Java EE and Jakarta EE bundles have been successfully re-packaged:

### 📥 1. Jira 11 Server (Jakarta EE / `jakarta.*` namespace)
* **File Name:** `persian-calendar-plugin-11.4.9-jakarta.jar`
* **Path:** [persian-calendar-plugin-11.4.9-jakarta.jar](file:///C:/Users/Hossein/.gemini/antigravity/scratch/Jira-persian-calender/target/persian-calendar-plugin-11.4.9-jakarta.jar)

### 📥 2. Jira 10 / 9 Server (Java EE / `javax.*` namespace)
* **File Name:** `persian-calendar-plugin-11.4.9.jar`
* **Path:** [persian-calendar-plugin-11.4.9.jar](file:///C:/Users/Hossein/.gemini/antigravity/scratch/Jira-persian-calender/target/persian-calendar-plugin-11.4.9.jar)

---

## 🔐 Security & License Architecture Fixes (v11.4.9)

### 1. License Bypass Vulnerability Patched (Critical)
* **The Problem**: In previous versions, the `LicenseServlet.java` and `LicenseResource.java` REST endpoints only checked if the user was logged in (`user != null`). This meant any basic user, reporter, or customer could hit the license activation endpoints and tamper with the plugin's license state.
* **The Fix**: We introduced strict Global Permission verification. The backend now explicitly validates `ComponentAccessor.getGlobalPermissionManager().hasPermission(GlobalPermissionKey.ADMINISTER, user)` on both the Servlet UI and all sensitive REST endpoints (`/activate`, `/server-id`, `/current`). Now, only Jira Administrators can manage licenses.

### 2. Standardised Data Center Server ID Hash
* **The Problem**: The `getServerIdHash()` method previously relied on the server's OS hostname (`java.net.InetAddress.getLocalHost().getHostName()`). In Jira Data Center setups with multiple nodes, the hostname changes per node, causing the generated Server ID hash to constantly shift depending on which node the user hit, breaking the license entirely.
* **The Fix**: We replaced the volatile IP/Hostname algorithm with the rock-solid Jira native `JiraLicenseManager.getServerId()` method. The Server ID is now identical and completely stable across all Data Center nodes.

---

## 🔬 Validation Checklist for Deployment

To test and confirm the fix on your Jira 11 server:

1. **Fully Uninstall Older Plugins**:
   * Go to **Jira Administration -> Manage Apps -> Persian Calendar Plugin**.
   * Click **Uninstall** to completely remove the old version (11.4.8 or below). This guarantees that Jira completely clears its active OSGi caches.
2. **Upload the New Version**:
   * Click **Upload App** and select the fresh Jakarta package: `persian-calendar-plugin-11.4.9-jakarta.jar`.
   * Confirm that the version is displayed as `11.4.9` in the Universal Plugin Manager (UPM).
3. **Validate Proximity Targeting (Range Search)**:
   * Go to the **Issue Navigator** (`/issues/?jql=`).
   * Select a date criteria (e.g. **Due Date**), select **Between** radio toggle in the basic search.
   * Click the **Start Date** calendar icon -> Persian Calendar should pop up on top beautifully. Select a date -> it must populate the first input field.
   * Click the **End Date** calendar icon -> Persian Calendar should pop up on top. Select a date -> it must populate the second input field correctly without overwriting the first!
4. **Console Log Check**:
   * Open F12 developer console and ensure that only one clean `[PC-PERSIAN-CALENDAR] Version 11.4.9 loaded.` line is displayed without any JS exceptions or warnings.
