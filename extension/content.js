// Content script for Voice Browser Agent
// Extracts structured information from the page for automation/LLM use

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "getPageInfo") {
    const pageInfo = extractPageInfo();
    console.log("Extracted page info:", pageInfo); // Debug log
    sendResponse({ info: pageInfo });
  } else if (request.action === "getPageHTML") {
    // Keep original functionality as fallback
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

function extractPageInfo() {
  const info = {};

  // Page URL
  info.url = window.location.href;
  info.title = document.title || '';

  // Headings (h1-h6)
  info.headings = [];
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
    info.headings.push({
      level: parseInt(heading.tagName.substring(1)),
      text: heading.innerText.trim(),
      index: index,
      id: heading.id || '' // Include element ID
    });
  });

  // Links
  info.links = [];
  document.querySelectorAll('a[href]').forEach((link, index) => {
    const href = link.getAttribute('href');
    const text = link.innerText.trim();
    // Only include links with meaningful text or href
    if (href && (text || href.startsWith('http'))) {
      info.links.push({
        text: text || '[No text]',
        href: href,
        index: index,
        id: link.id || '' // Include element ID
      });
    }
  });

  // Forms
  info.forms = [];
  document.querySelectorAll('form').forEach((form, formIndex) => {
    const formInfo = {
      index: formIndex,
      action: form.getAttribute('action') || '',
      method: form.getAttribute('method') || 'get',
      inputs: [],
      buttons: []
    };

    // Inputs, selects, textareas
    form.querySelectorAll('input, select, textarea').forEach((input) => {
      const inputInfo = {
        type: input.type || input.tagName.toLowerCase(),
        name: input.name || '',
        placeholder: input.placeholder || '',
        value: input.value || '',
        required: input.required,
        id: input.id || '' // Include element ID
      };
      formInfo.inputs.push(inputInfo);
    });

    // Buttons
    form.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]').forEach((button) => {
      const buttonInfo = {
        type: button.type || button.tagName.toLowerCase(),
        name: button.name || '',
        value: button.value || '',
        text: button.innerText || button.value || '',
        id: button.id || '' // Include element ID
      };
      formInfo.buttons.push(buttonInfo);
    });

    info.forms.push(formInfo);
  });

  // Standalone buttons (not in forms)
  info.buttons = [];
  document.querySelectorAll('button:not(form button), input[type="button"]:not(form input), input[type="submit"]:not(form input), input[type="reset"]:not(form input)').forEach((button, index) => {
    const buttonInfo = {
      index: index,
      type: button.type || button.tagName.toLowerCase(),
      name: button.name || '',
      value: button.value || '',
      text: button.innerText || button.value || '',
      // Try to get a meaningful label
      ariaLabel: button.getAttribute('aria-label') || '',
      title: button.getAttribute('title') || '',
      id: button.id || '' // Include element ID
    };
    info.buttons.push(buttonInfo);
  });

  // Input boxes (standalone inputs not in forms)
  info.inputs = [];
  document.querySelectorAll('input:not(form input), textarea:not(form textarea), select:not(form select)').forEach((input, index) => {
    const inputInfo = {
      index: index,
      type: input.type || input.tagName.toLowerCase(),
      name: input.name || '',
      placeholder: input.placeholder || '',
      value: input.value || '',
      required: input.required,
      // Try to get associated label text
      label: getAssociatedLabel(input),
      id: input.id || '' // Include element ID
    };
    info.inputs.push(inputInfo);
  });

  return info;
}

function getAssociatedLabel(element) {
  // Try to find label by id
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.innerText.trim();
  }

  // Try to find parent label
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      return parent.innerText.trim();
    }
    parent = parent.parentElement;
  }

  return '';
}