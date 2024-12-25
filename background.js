const DEFAULT_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // Default: 5 minutes

// Track the last activity timestamp for each tab
const tabActivity = {};

// Whitelist for domains
let whitelistDomains = [];
let inactivityTimeout = DEFAULT_INACTIVITY_TIMEOUT;

// Load whitelist and timeout from storage
chrome.storage.local.get(["whitelist", "inactivityTimeout"], (data) => {
  whitelistDomains = data.whitelist || [];
  inactivityTimeout = data.inactivityTimeout || DEFAULT_INACTIVITY_TIMEOUT;
});

// Listen for tab updates (navigation, reloading)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    tabActivity[tabId] = Date.now();
  }
});

// Listen for tab activations (tab switching)
chrome.tabs.onActivated.addListener((activeInfo) => {
  tabActivity[activeInfo.tabId] = Date.now();
});

// Periodically check for inactive tabs
chrome.alarms.create("checkInactiveTabs", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkInactiveTabs") {
    const now = Date.now();
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        const lastActive = tabActivity[tab.id] || now;

        try {
          // Ensure the tab has a valid URL
          const tabUrl = new URL(tab.url);

          // Check for inactivity and whitelist
          if (
            !tab.active && // Ignore active tabs
            !tab.pinned && // Ignore pinned tabs
            now - lastActive > inactivityTimeout &&
            !whitelistDomains.includes(tabUrl.hostname) // Ignore whitelisted domains
          ) {
            chrome.tabs.discard(tab.id).then(() => {
              console.log(`Tab ${tab.id} suspended.`);
              chrome.notifications.create({
                type: "basic",
                iconUrl: "icon128.png",
                title: "Tab Suspended",
                message: `Tab "${tab.title}" has been suspended.`,
              });
            }).catch((err) => {
              console.warn(`Cannot discard tab ${tab.id}. Reason: ${err.message}`);
            });
          }
        } catch (error) {
          console.warn(`Skipping tab ${tab.id}: Invalid URL.`);
        }
      });
    });
  }
});

// Save whitelist and timeout values
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveWhitelist") {
    whitelistDomains = request.data;
    chrome.storage.local.set({ whitelist: whitelistDomains }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === "saveTimeout") {
    inactivityTimeout = request.data * 60 * 1000; // Convert minutes to ms
    chrome.storage.local.set({ inactivityTimeout }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

chrome.alarms.create("checkMemoryUsage", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkMemoryUsage") {
    chrome.system.memory.getInfo((memoryInfo) => {
      console.log("Total Memory:", memoryInfo.capacity / (1024 * 1024), "MB");
      console.log("Available Memory:", memoryInfo.availableCapacity / (1024 * 1024), "MB");
    });
  }
});

// Clean up activity data when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabActivity[tabId];
});
