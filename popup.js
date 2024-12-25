document.getElementById("saveWhitelist").addEventListener("click", () => {
  const whitelist = document
    .getElementById("whitelist")
    .value.split(",")
    .map((domain) => domain.trim());
  chrome.storage.local.set({ whitelist }, () => {
    alert("Whitelist saved!");
  });
});

function updateSuspendedTabs() {
  chrome.storage.local.get(["suspendedTabs", "memorySaved"], (data) => {
    const suspendedTabs = data.suspendedTabs || [];
    const memorySaved = data.memorySaved || 0;

    const tabList = document.getElementById("tabList");
    tabList.innerHTML = ""; // Clear old list
    suspendedTabs.forEach((tab) => {
      const listItem = document.createElement("li");
      listItem.textContent = tab.domain;
      tabList.appendChild(listItem);
    });

    document.getElementById("stats").textContent = `Suspended Tabs: ${suspendedTabs.length}`;
    document.getElementById("memoryStats").textContent = `Memory Saved: ${memorySaved.toFixed(2)} MB`;
  });
}

document.getElementById("suspendTabs").addEventListener("click", () => {
  chrome.storage.local.get("whitelist", (data) => {
    const whitelist = data.whitelist || [];
    chrome.tabs.query({}, (tabs) => {
      const promises = [];
      const suspendedTabs = [];
      let memorySaved = 0;

      tabs.forEach((tab) => {
        if (
          !tab.active && // Ignore active tabs
          !tab.pinned && // Ignore pinned tabs
          tab.url && // Ensure tab has a URL
          !whitelist.includes(new URL(tab.url).hostname) // Ignore whitelisted domains
        ) {
          promises.push(
            chrome.tabs.discard(tab.id).then(
              () => {
                suspendedTabs.push({ id: tab.id, domain: new URL(tab.url).hostname });
                memorySaved += 50; // Assume 50 MB saved per tab for now
              },
              (error) => {
                console.warn(`Cannot discard tab with id: ${tab.id}. Reason: ${error.message}`);
              }
            )
          );
        }
      });

      Promise.all(promises).then(() => {
        chrome.storage.local.set({ suspendedTabs, memorySaved }, () => {
          updateSuspendedTabs();
          alert("Inactive tabs (excluding whitelisted ones) have been suspended!");
        });
      });
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  chrome.system.memory.getInfo((memoryInfo) => {
    const totalMemory = (memoryInfo.capacity / (1024 * 1024)).toFixed(2);
    const availableMemory = (memoryInfo.availableCapacity / (1024 * 1024)).toFixed(2);
    document.getElementById("memoryInfo").textContent = `Total: ${totalMemory} MB, Available: ${availableMemory} MB`;
  });
});

document.getElementById("resumeTabs").addEventListener("click", () => {
  chrome.tabs.query({ discarded: true }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.update(tab.id, { active: true });
    });
    alert("Suspended tabs have been resumed!");
  });

  chrome.storage.local.remove(["suspendedTabs", "memorySaved"], () => {
    updateSuspendedTabs();
  });
});

updateSuspendedTabs();

document.getElementById("saveTimeout").addEventListener("click", () => {
  const timeout = parseInt(document.getElementById("timeout").value, 10) || 5;
  chrome.storage.local.set({ inactivityTimeout: timeout * 60 * 1000 }, () => {
    alert("Inactivity timeout saved!");
  });
});

document.getElementById("darkMode").addEventListener("change", (event) => {
  const isDarkMode = event.target.checked;
  document.body.classList.toggle("dark", isDarkMode);
  chrome.storage.local.set({ darkMode: isDarkMode });
});

chrome.storage.local.get("darkMode", (data) => {
  const isDarkMode = data.darkMode || false;
  document.body.classList.toggle("dark", isDarkMode);
  document.getElementById("darkMode").checked = isDarkMode;
});

chrome.storage.local.get("inactivityTimeout", (data) => {
  const timeoutMinutes = (data.inactivityTimeout || 5 * 60 * 1000) / 60 / 1000;
  document.getElementById("timeout").value = timeoutMinutes;
});
