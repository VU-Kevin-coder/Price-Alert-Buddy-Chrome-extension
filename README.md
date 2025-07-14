### Price Alert Buddy
Price Alert Buddy is a lightweight Chrome extension that helps you track product prices on popular e-commerce websites and get notified when prices drop below your set threshold. Stay informed and save money by monitoring your favorite products effortlessly.

## Features
Add products by URL from Amazon, eBay, Walmart, BestBuy, and more

Set custom price alert thresholds

Automatic background price checks at configurable intervals

View interactive price history charts

Receive desktop notifications on price drops

Context menu integration to quickly add products

Localization support (multi-language messages)

Data stored locally in browser storage for privacy

## Installation
Clone or download this repository

Open Chrome and navigate to chrome://extensions/

Enable Developer mode (toggle top-right)

Click Load unpacked and select the price-alert-buddy folder

The extension icon should appear in your toolbar

## Usage
Click the Price Alert Buddy icon to open the popup

Paste a product URL and set your desired alert price

Click Add Product to start tracking

Switch to the Price History tab to view past price changes

Receive notifications when a product’s price drops below your threshold

Use the context menu on product links to add them quickly

## Supported Sites
Amazon

eBay

Walmart

BestBuy

## Development
Background logic runs in a service worker (Manifest V3)

Content scripts scrape product data from supported sites

Popup UI built with HTML, CSS, and vanilla JavaScript

Price charts rendered using Chart.js

Localization messages in _locales/en/messages.json

## Contributing
Contributions, issues, and feature requests are welcome! Feel free to fork the project and submit pull requests.

## License
MIT License
