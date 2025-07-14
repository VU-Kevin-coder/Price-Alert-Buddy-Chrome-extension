document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initAddProductForm();
  await loadProducts();
  setupListeners();

  // Listen for price updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "pricesUpdated") {
      loadProducts();
    }
  });
});

// Initialize tab switching logic
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      const tabName = button.dataset.tab;
      tabContents.forEach((content) => {
        content.classList.remove("active");
        if (content.id === `${tabName}Tab`) {
          content.classList.add("active");
        }
      });

      if (tabName === "history") {
        loadPriceHistory();
      }
    });
  });
}

// Setup add product form submission
function initAddProductForm() {
  const addProductBtn = document.getElementById("addProduct");

  addProductBtn.addEventListener("click", async () => {
    const urlInput = document.getElementById("productUrl");
    const priceInput = document.getElementById("priceThreshold");
    const url = urlInput.value.trim();
    const threshold = parseFloat(priceInput.value);

    if (!url || isNaN(threshold)) {
      showAlert("Please enter a valid URL and price threshold", "error");
      return;
    }

    try {
      toggleLoading(addProductBtn, true);

      const productInfo = await chrome.runtime.sendMessage({
        action: "scrapeProductInfo",
        url,
      });

      if (!productInfo || !productInfo.currentPrice) {
        throw new Error("Could not extract product information");
      }

      await saveProduct({
        url,
        title: productInfo.title,
        currentPrice: productInfo.currentPrice,
        threshold,
        domain: productInfo.domain,
      });

      urlInput.value = "";
      priceInput.value = "";
      await loadProducts();
      showAlert("Product added successfully!", "success");
    } catch (error) {
      console.error("Error adding product:", error);
      showAlert("Error adding product. Please try again.", "error");
    } finally {
      toggleLoading(addProductBtn, false);
    }
  });
}

// Load tracked products and render them
async function loadProducts() {
  const productsContainer = document.getElementById("productsContainer");
  const { products } = await chrome.storage.local.get("products");

  productsContainer.innerHTML = "";

  if (!products || Object.keys(products).length === 0) {
    productsContainer.innerHTML = `
      <div class="empty-state">
        <img src="../assets/images/no-products.svg" alt="No products" />
        <p>${chrome.i18n.getMessage("noProductsMessage") || "No products tracked yet."}</p>
      </div>
    `;
    return;
  }

  for (const productId in products) {
    const product = products[productId];
    const productElement = createProductElement(product);
    productsContainer.appendChild(productElement);
  }
}

// Create DOM element for each product entry
function createProductElement(product) {
  const element = document.createElement("div");
  element.className = "product-item";
  element.dataset.id = product.id;

  const domainIcon = getDomainIcon(product.domain);
  const lastChecked = product.lastChecked
    ? new Date(product.lastChecked).toLocaleString()
    : "Never";

  element.innerHTML = `
    <div class="product-header">
      <img src="${domainIcon}" alt="${product.domain}" class="domain-icon" />
      <h3 class="product-title" title="${product.title}">${product.title}</h3>
      <button class="icon-btn remove-btn" title="Remove">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
        </svg>
      </button>
    </div>
    <div class="product-details">
      <div class="price-info">
        <span class="current-price">$${product.currentPrice.toFixed(2)}</span>
        <span class="threshold">${
          chrome.i18n.getMessage("alertBelowText") || "Alert below"
        } $${product.threshold.toFixed(2)}</span>
      </div>
      <div class="meta-info">
        <span class="last-checked">${
          chrome.i18n.getMessage("lastCheckedText") || "Last checked"
        } ${lastChecked}</span>
        <button class="view-history-btn">View History</button>
      </div>
    </div>
  `;

  element.querySelector(".remove-btn").addEventListener("click", () =>
    removeProduct(product.id)
  );

  element.querySelector(".view-history-btn").addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="history"]').click();
    loadPriceHistory(product.id);
  });

  return element;
}

// Load and render price history chart and list
async function loadPriceHistory(productId = null) {
  const { products } = await chrome.storage.local.get("products");
  const historyContainer = document.getElementById("historyContainer");
  const chartCanvas = document.getElementById("priceHistoryChart");

  historyContainer.innerHTML = "";

  if (!productId) {
    historyContainer.innerHTML = `
      <div class="empty-state">
        <img src="../assets/icons/icon16.png" alt="Select product" />
        <p>Select a product from the Track tab to view its price history</p>
      </div>
    `;
    if (window.priceChart) {
      window.priceChart.destroy();
      window.priceChart = null;
    }
    return;
  }

  const product = products[productId];
  if (!product || !product.priceHistory || product.priceHistory.length === 0) {
    historyContainer.innerHTML = `
      <div class="empty-state">
        <img src="../assets/icons/icon16.png" alt="No history" />
        <p>No price history available for this product yet</p>
      </div>
    `;
    if (window.priceChart) {
      window.priceChart.destroy();
      window.priceChart = null;
    }
    return;
  }

  renderPriceChart(chartCanvas, product);

  product.priceHistory.forEach((entry, index) => {
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";

    const date = new Date(entry.date);
    const change =
      index > 0 ? entry.price - product.priceHistory[index - 1].price : 0;

    historyItem.innerHTML = `
      <div class="history-date">${date.toLocaleString()}</div>
      <div class="history-price">
        <span>$${entry.price.toFixed(2)}</span>
        ${
          change !== 0
            ? `<span class="price-change ${
                change > 0 ? "increase" : "decrease"
              }">
          ${change > 0 ? "↑" : "↓"} $${Math.abs(change).toFixed(2)}
        </span>`
            : ""
        }
      </div>
    `;

    historyContainer.appendChild(historyItem);
  });
}

// Render Chart.js line chart for price history
function renderPriceChart(canvas, product) {
  const ctx = canvas.getContext("2d");
  const history = product.priceHistory;

  const labels = history.map((entry) =>
    new Date(entry.date).toLocaleDateString()
  );
  const data = history.map((entry) => entry.price);

  if (window.priceChart) {
    window.priceChart.data.labels = labels;
    window.priceChart.data.datasets[0].data = data;
    window.priceChart.options.plugins.title.text = product.title;
    window.priceChart.update();
  } else {
    window.priceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Price History",
            data,
            borderColor: "#3498db",
            backgroundColor: "rgba(52, 152, 219, 0.1)",
            tension: 0.1,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: product.title,
            font: {
              size: 16,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => `$${context.parsed.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: (value) => `$${value}`,
            },
          },
        },
      },
    });
  }
}

// Helper to get domain icon based on product domain
function getDomainIcon(domain) {
  const domainLower = domain.toLowerCase();
  if (domainLower.includes("amazon")) return "../assets/images/amazon-logo.png";
  if (domainLower.includes("ebay")) return "../assets/images/ebay-logo.png";
  if (domainLower.includes("walmart"))
    return "../assets/images/walmart-logo.png";
  return "../assets/icons/icon32.png";
}

// Show/hide loading spinner on buttons
function toggleLoading(button, isLoading) {
  const spinner = button.querySelector(".spinner");
  const btnText = button.querySelector(".btn-text");

  if (isLoading) {
    spinner.classList.remove("hidden");
    btnText.classList.add("hidden");
    button.disabled = true;
  } else {
    spinner.classList.add("hidden");
    btnText.classList.remove("hidden");
    button.disabled = false;
  }
}

// Show temporary alert message on popup
function showAlert(message, type = "info") {
  const alert = document.createElement("div");
  alert.className = `alert ${type}`;
  alert.textContent = message;

  document.body.appendChild(alert);

  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => alert.remove(), 300);
  }, 3000);
}

// Save product to local storage
async function saveProduct(product) {
  const products = await getProducts();
  const productId = generateId();

  products[productId] = {
    id: productId,
    ...product,
    priceHistory: [
      {
        price: product.currentPrice,
        date: new Date().toISOString(),
      },
    ],
    lastChecked: new Date().toISOString(),
  };

  await chrome.storage.local.set({ products });
}

// Remove product from local storage and refresh UI
async function removeProduct(productId) {
  const products = await getProducts();
  delete products[productId];
  await chrome.storage.local.set({ products });
  await loadProducts();
}

// Get all products from storage (returns empty object if none)
async function getProducts() {
  const { products } = await chrome.storage.local.get("products");
  return products || {};
}

// Generate unique id string for products
function generateId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
  );
}

// Setup listeners for buttons like settings
function setupListeners() {
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }
}
