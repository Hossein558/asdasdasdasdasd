#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

JIRA_URL="http://localhost:8080"
PLUGIN_KEY="ir.atlassian.jira.plugins.persian-calendar-plugin"
AUTH="admin:admin"
PLUGIN_JAR=$1

if [ -z "$PLUGIN_JAR" ]; then
    echo "Usage: $0 <path_to_plugin_jar>"
    exit 1
fi

if [ ! -f "$PLUGIN_JAR" ]; then
    echo "Error: Plugin JAR not found at $PLUGIN_JAR"
    exit 1
fi

echo "========================================================"
echo "Waiting for Jira to start and become healthy..."
echo "========================================================"

MAX_ATTEMPTS=60
SLEEP_TIME=10
ATTEMPT=1
IS_READY=false

set +e
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$JIRA_URL/status" || echo "000")
    
    if [ "$HTTP_STATUS" == "200" ]; then
        STATE=$(curl -s "$JIRA_URL/status" | grep -o '"state":"RUNNING"' || true)
        if [ ! -z "$STATE" ]; then
            echo "Jira is fully RUNNING!"
            IS_READY=true
            break
        fi
    fi
    
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: Jira is not ready yet (HTTP $HTTP_STATUS). Waiting $SLEEP_TIME seconds..."
    sleep $SLEEP_TIME
    ATTEMPT=$((ATTEMPT + 1))
done
set -e

if [ "$IS_READY" = false ]; then
    echo "Error: Jira failed to start within the expected time."
    exit 1
fi

# Additional wait for UPM to fully initialize after Jira reports RUNNING
echo "Waiting an additional 30 seconds for Universal Plugin Manager to fully initialize..."
sleep 30

echo "========================================================"
echo "Uploading and Installing Plugin: $PLUGIN_JAR"
echo "========================================================"

# Get UPM Token
UPM_TOKEN=$(curl -s -u "$AUTH" -I "$JIRA_URL/rest/plugins/1.0/" | grep -i upm-token | awk -F':' '{print $2}' | tr -d ' \r')

if [ -z "$UPM_TOKEN" ]; then
    echo "Error: Failed to obtain UPM token."
    exit 1
fi

echo "UPM Token: $UPM_TOKEN"

# Upload plugin
UPLOAD_RESPONSE=$(curl -s -u "$AUTH" -X POST \
    "$JIRA_URL/rest/plugins/1.0/?token=$UPM_TOKEN" \
    -F "plugin=@$PLUGIN_JAR")

echo "Upload Response: $UPLOAD_RESPONSE"

# Wait for plugin to be processed
echo "Waiting 15 seconds for plugin installation to complete..."
sleep 15

# Get Plugin Self URL which includes the exact key representation in UPM
PLUGIN_INFO=$(curl -s -u "$AUTH" "$JIRA_URL/rest/plugins/1.0/$PLUGIN_KEY-key")

if echo "$PLUGIN_INFO" | grep -q '"enabled":true'; then
    echo "Success: Plugin installed and is ENABLED."
else
    echo "Error: Plugin is not enabled after installation!"
    echo "Info: $PLUGIN_INFO"
    exit 1
fi

echo "========================================================"
echo "Testing Plugin Disablement..."
echo "========================================================"

DISABLE_RESPONSE=$(curl -s -u "$AUTH" -X PUT \
    "$JIRA_URL/rest/plugins/1.0/$PLUGIN_KEY-key" \
    -H "Content-Type: application/vnd.atlassian.upm.plugin+json" \
    -d '{"enabled":false}')

echo "Disable Response: $DISABLE_RESPONSE"
sleep 5

PLUGIN_INFO=$(curl -s -u "$AUTH" "$JIRA_URL/rest/plugins/1.0/$PLUGIN_KEY-key")
if echo "$PLUGIN_INFO" | grep -q '"enabled":false'; then
    echo "Success: Plugin is DISABLED."
else
    echo "Error: Plugin failed to disable!"
    echo "Info: $PLUGIN_INFO"
    exit 1
fi

echo "========================================================"
echo "Testing Plugin Re-Enablement..."
echo "========================================================"

ENABLE_RESPONSE=$(curl -s -u "$AUTH" -X PUT \
    "$JIRA_URL/rest/plugins/1.0/$PLUGIN_KEY-key" \
    -H "Content-Type: application/vnd.atlassian.upm.plugin+json" \
    -d '{"enabled":true}')

echo "Enable Response: $ENABLE_RESPONSE"
sleep 5

PLUGIN_INFO=$(curl -s -u "$AUTH" "$JIRA_URL/rest/plugins/1.0/$PLUGIN_KEY-key")
if echo "$PLUGIN_INFO" | grep -q '"enabled":true'; then
    echo "Success: Plugin is ENABLED again."
else
    echo "Error: Plugin failed to re-enable!"
    echo "Info: $PLUGIN_INFO"
    exit 1
fi

echo "========================================================"
echo "All lifecycle tests passed successfully!"
echo "========================================================"
exit 0
