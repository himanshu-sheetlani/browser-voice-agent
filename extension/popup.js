// Popup script for Voice Browser Agent
// Extracts and displays structured page information for automation/LLM use

let pageSnapshot;

document.addEventListener('DOMContentLoaded', () => {
  const pageSnapshotDiv = document.getElementById('page-snapshot');

  // Show loading state
  pageSnapshotDiv.textContent = 'Extracting page information...';

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

    // Try to get page info with retries
    let retryCount = 0;
    const maxRetries = 3;

    const attemptGetPageInfo = () => {
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: "getPageInfo" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Handle specific error cases
            if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
              retryCount++;
              if (retryCount <= maxRetries) {
                // Wait a bit and try again (exponential backoff)
                setTimeout(attemptGetPageInfo, 500 * retryCount);
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

          if (response && response.info) {
            // Display the structured information in a readable format
            pageSnapshotDiv.innerHTML = formatPageInfo(response.info);

            // Store the info for potential further use (e.g., by other parts of the extension)
            pageSnapshot = response.info;

          } else {
            pageSnapshotDiv.textContent = 'No response from content script';
          }
        }
      );
    };

    // Start the first attempt
    attemptGetPageInfo();
  });
});

// Helper function to escape HTML for display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format the extracted page information into readable HTML/text
function formatPageInfo(info) {
  let html = '<div style="font-family: monospace; line-height: 1.5;">';

  // Page URL and Title
  html += `<div><strong>Page URL:</strong> ${escapeHtml(info.url)}</div>`;
  if (info.title) {
    html += `<div><strong>Page Title:</strong> ${escapeHtml(info.title)}</div>`;
  }
  html += '<hr>';

  // Headings
  if (info.headings && info.headings.length > 0) {
    html += '<div><strong>Headings:</strong></div><ul>';
    info.headings.forEach(h => {
      const indent = '  '.repeat(h.level - 1);
      let headingText = `h${h.level}: ${escapeHtml(h.text)}`;
      if (h.id) {
        headingText += ` (id: ${escapeHtml(h.id)})`;
      }
      html += `<li>${indent}${headingText}</li>`;
    });
    html += '</ul><hr>';
  }

  // Links
  if (info.links && info.links.length > 0) {
    html += `<div><strong>Links (${info.links.length}):</strong></div>`;
    // Limit to first 20 links to avoid overwhelming display
    const linksToShow = info.links.slice(0, 20);
    html += '<ul>';
    linksToShow.forEach((link, index) => {
      let linkText = `${escapeHtml(link.text || '[No text]')}: ${escapeHtml(link.href)}`;
      if (link.id) {
        linkText += ` (id: ${escapeHtml(link.id)})`;
      }
      html += `<li>${linkText}</li>`;
    });
    if (info.links.length > 20) {
      html += `<li><em>... and ${info.links.length - 20} more links</em></li>`;
    }
    html += '</ul><hr>';
  }

  // Forms
  if (info.forms && info.forms.length > 0) {
    html += `<div><strong>Forms (${info.forms.length}):</strong></div>`;
    info.forms.forEach((form, formIndex) => {
      html += `<div><strong>Form #${formIndex + 1}</strong> (${form.method.toUpperCase()} → ${escapeHtml(form.action || '[no action]')}):</div>`;

      if (form.inputs && form.inputs.length > 0) {
        html += '<div style="margin-left: 20px;"><strong>Inputs:</strong><ul>';
        form.inputs.forEach((input, index) => {
          let details = `(${input.type})`;
          if (input.name) details += ` name="${escapeHtml(input.name)}"`;
          if (input.placeholder) details += ` placeholder="${escapeHtml(input.placeholder)}"`;
          if (input.value) details += ` value="${escapeHtml(input.value)}"`;
          if (input.required) details += ' required';
          if (input.id) details += ` id="${escapeHtml(input.id)}"`;
          html += `<li>${details}</li>`;
        });
        html += '</ul></div>';
      }

      if (form.buttons && form.buttons.length > 0) {
        html += '<div style="margin-left: 20px;"><strong>Buttons:</strong><ul>';
        form.buttons.forEach((button, index) => {
          let details = `(${button.type})`;
          if (button.name) details += ` name="${escapeHtml(button.name)}"`;
          if (button.value) details += ` value="${escapeHtml(button.value)}"`;
          if (button.text) details += ` text="${escapeHtml(button.text)}"`;
          if (button.id) details += ` id="${escapeHtml(button.id)}"`;
          html += `<li>${details}</li>`;
        });
        html += '</ul></div>';
      }

      html += '<br>';
    });
    html += '<hr>';
  }

  // Standalone Inputs
  if (info.inputs && info.inputs.length > 0) {
    html += `<div><strong>Standalone Inputs (${info.inputs.length}):</strong></div><ul>`;
    info.inputs.forEach((input, index) => {
      let details = `(${input.type})`;
      if (input.name) details += ` name="${escapeHtml(input.name)}"`;
      if (input.placeholder) details += ` placeholder="${escapeHtml(input.placeholder)}"`;
      if (input.value) details += ` value="${escapeHtml(input.value)}"`;
      if (input.required) details += ' required';
      if (input.label) details += ` label="${escapeHtml(input.label)}"`;
      if (input.id) details += ` id="${escapeHtml(input.id)}"`;
      html += `<li>${details}</li>`;
    });
    html += '</ul><hr>';
  }

  // Standalone Buttons
  if (info.buttons && info.buttons.length > 0) {
    html += `<div><strong>Standalone Buttons (${info.buttons.length}):</strong></div><ul>`;
    info.buttons.forEach((button, index) => {
      let details = `(${button.type})`;
      if (button.name) details += ` name="${escapeHtml(button.name)}"`;
      if (button.value) details += ` value="${escapeHtml(button.value)}"`;
      if (button.text) details += ` text="${escapeHtml(button.text)}"`;
      if (button.ariaLabel) details += ` aria-label="${escapeHtml(button.ariaLabel)}"`;
      if (button.title) details += ` title="${escapeHtml(button.title)}"`;
      if (button.id) details += ` id="${escapeHtml(button.id)}"`;
      html += `<li>${details}</li>`;
    });
    html += '</ul>';
  }

  html += '</div>';

  // If we have very little information, show a hint
  if (!info.headings?.length && !info.links?.length && !info.forms?.length && !info.inputs?.length && !info.buttons?.length) {
    html += '<div style="color: #666; font-style: italic;">No significant interactive elements detected on this page.</div>';
  }

  return html;
}