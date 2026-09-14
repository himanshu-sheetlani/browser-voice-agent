// Popup script for Voice Browser Agent
// Captures the current tab's page HTML and displays it in page-snapshot div

document.addEventListener('DOMContentLoaded', () => {
  const pageSnapshotDiv = document.getElementById('page-snapshot');
  
  // Show loading state
  pageSnapshotDiv.textContent = 'Loading page snapshot...';

  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      pageSnapshotDiv.textContent = 'No active tab found';
      return;
    }

    const activeTab = tabs[0];

    // Check if we can inject scripts in this tab (not a restricted page)
    if (!activeTab.url ||
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('edge://') ||
        activeTab.url.startsWith('about://')) {
      pageSnapshotDiv.textContent = 'Cannot access this page type';
      return;
    }

    // Try to get page HTML with retries
    let retryCount = 0;
    const maxRetries = 3;

    const attemptGetPageHTML = () => {
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: "getPageHTML" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Handle specific error cases
            if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
              retryCount++;
              if (retryCount <= maxRetries) {
                // Wait a bit and try again (exponential backoff)
                setTimeout(attemptGetPageHTML, 500 * retryCount);
                return;
              } else {
                // Max retries exceeded
                pageSnapshotDiv.innerHTML = `
                  <div style="color: orange; padding: 10px;">
                    <strong>Warning:</strong> Content script not responding after ${maxRetries} attempts.<br>
                    This can happen on:<br>
                    • Pages that just started loading<br>
                    • Chrome internal pages<br>
                    • Pages with strict security policies<br>
                    • Pages that block content scripts<br>
                    <br>
                    <strong>To fix:</strong><br>
                    1. Refresh the page and try again<br>
                    2. If developing, reload the extension (chrome://extensions)<br>
                    3. Try a different website<br>
                  </div>
                `;
              }
            } else {
              pageSnapshotDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
            }
            return;
          }

          if (response && response.html) {
            // Display the HTML in the page-snapshot div
            // We'll show it as formatted/code for readability
            pageSnapshotDiv.innerHTML = `<pre>${escapeHtml(response.html)}</pre>`;
          } else {
            pageSnapshotDiv.textContent = 'No response from content script';
          }
        }
      );
    };

    // Start the first attempt
    attemptGetPageHTML();
  });
});

// Helper function to escape HTML for display in <pre> tag
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}