export async function scrapeProductPrice(url) {
  try {
    // Check which domain we're dealing with
    const domain = getDomainFromUrl(url);
    
    // Execute the appropriate content script
    const tab = await chrome.tabs.create({ url, active: false });
    
    const productInfo = await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [`content-scripts/${domain.toLowerCase()}.js`]
          }, () => {
            chrome.tabs.sendMessage(tab.id, { action: 'extractProductInfo' }, (response) => {
              chrome.tabs.remove(tab.id);
              resolve(response);
            });
          });
        }
      });
    });

    return productInfo;
  } catch (error) {
    console.error('Error scraping product price:', error);
    return null;
  }
}

function getDomainFromUrl(url) {
  if (url.includes('amazon.com')) return 'amazon';
  if (url.includes('ebay.com')) return 'ebay';
  if (url.includes('walmart.com')) return 'walmart';
  return 'unknown';
}