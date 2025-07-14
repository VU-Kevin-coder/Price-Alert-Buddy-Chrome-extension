function extractAmazonProductInfo() {
  // Get product title
  const titleElement = document.getElementById('productTitle') || 
                     document.querySelector('h1.a-size-large');
  const title = titleElement ? titleElement.textContent.trim() : 'Unknown Product';

  // Get current price
  let price = 0;
  const priceElement = document.querySelector('.a-price .a-offscreen') || 
                      document.querySelector('#priceblock_ourprice') ||
                      document.querySelector('#priceblock_dealprice');
  
  if (priceElement) {
    const priceText = priceElement.textContent.trim().replace(/[^\d.]/g, '');
    price = parseFloat(priceText);
  }

  return {
    domain: 'Amazon',
    title,
    currentPrice: price,
    url: window.location.href
  };
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProductInfo') {
    const productInfo = extractAmazonProductInfo();
    sendResponse(productInfo);
  }
});