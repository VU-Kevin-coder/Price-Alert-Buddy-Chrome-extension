import { scrapeProductPrice } from "./priceScraper.js";


chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "scrapeProductInfo" && message.url) {
    try {
      // Assuming you have a function scrapeProductPrice(url) that extracts price & info
      const productInfo = await scrapeProductPrice(message.url);
      sendResponse(productInfo); // send back product info to popup.js
    } catch (error) {
      console.error('Error scraping product info:', error);
      sendResponse(null);
    }
    return true; // Keep the message channel open for async response
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  setupAlarm();
  registerContextMenus();
});

async function initializeStorage() {
  const result = await chrome.storage.local.get(["products", "settings"]);

  if (!result.products) {
    await chrome.storage.local.set({ products: {} });
  }

  if (!result.settings) {
    await chrome.storage.local.set({
      settings: {
        checkFrequency: 360,
        notificationSound: true,
      },
    });
  }
}

function setupAlarm() {
  chrome.alarms.get("priceCheck", async (alarm) => {
    if (!alarm) {
      const { settings } = await chrome.storage.local.get("settings");
      chrome.alarms.create("priceCheck", {
        periodInMinutes: settings.checkFrequency,
      });
    }
  });
}

function registerContextMenus() {
  chrome.contextMenus.create({
    id: "addToPriceAlert",
    title: "Add to Price Alert Buddy",
    contexts: ["link"],
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (
    info.menuItemId === "addToPriceAlert" &&
    isSupportedUrl(info.linkUrl)
  ) {
    await chrome.tabs.sendMessage(tab.id, {
      action: "showAddProductDialog",
      url: info.linkUrl,
    });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "priceCheck") {
    await checkAllPrices();
  }
});

async function checkAllPrices() {
  const { products } = await chrome.storage.local.get("products");
  const updatedProducts = { ...products };
  let hasUpdates = false;

  for (const productId in products) {
    const product = products[productId];
    try {
      const productInfo = await scrapeProductPrice(product.url);

      if (
        productInfo &&
        typeof productInfo.currentPrice === "number" &&
        productInfo.currentPrice !== product.currentPrice
      ) {
        const priceHistory = product.priceHistory || [];
        priceHistory.push({
          price: productInfo.currentPrice,
          date: new Date().toISOString(),
        });

        updatedProducts[productId] = {
          ...product,
          currentPrice: productInfo.currentPrice,
          lastChecked: new Date().toISOString(),
          priceHistory,
        };

        hasUpdates = true;

        if (productInfo.currentPrice <= product.threshold) {
          showPriceAlertNotification(updatedProducts[productId]);
        }
      }
    } catch (error) {
      console.error(`Error checking price for ${product.title}`, error);
    }
  }

  if (hasUpdates) {
    await chrome.storage.local.set({ products: updatedProducts });
    chrome.runtime.sendMessage({ action: "pricesUpdated" });
  }
}

function showPriceAlertNotification(product) {
  const id = `price-alert-${product.id}`;
  const newPrice = product.currentPrice;

  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "assets/icons/icon48.png",
    title: "Price Drop Alert!",
    message: `${product.title} is now $${newPrice.toFixed(
      2
    )} (threshold: $${product.threshold.toFixed(2)})`,
    contextMessage: "Price Alert Buddy",
    buttons: [{ title: "View Product" }],
  });

  chrome.storage.local.get("settings", ({ settings }) => {
    if (settings.notificationSound) {
      console.log("Sound would play here (not supported in service worker)");
    }
  });
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("price-alert-")) {
    const productId = notificationId.replace("price-alert-", "");
    chrome.storage.local.get("products", ({ products }) => {
      const product = products[productId];
      if (product) {
        chrome.tabs.create({ url: product.url });
      }
    });
  }
});

function isSupportedUrl(url) {
  return (
    url.includes("amazon.com") ||
    url.includes("ebay.com") ||
    url.includes("walmart.com") ||
    url.includes("bestbuy.com")
  );
}
