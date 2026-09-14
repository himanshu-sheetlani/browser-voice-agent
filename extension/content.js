// Content script for Voice Browser Agent
// Listens for messages from popup and responds with page information

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "getPageHTML") {
    // Get the entire HTML of the page
    const pageHTML = document.documentElement.outerHTML;
    sendResponse({ html: pageHTML });
  } else if (request.action === "getPageText") {
    // Get the visible text of the page
    const pageText = document.body.innerText;
    sendResponse({ text: pageText });
  }
  // Return true to indicate we will respond asynchronously
  return true;
});