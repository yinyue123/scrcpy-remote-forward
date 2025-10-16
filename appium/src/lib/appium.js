const { remote } = require('webdriverio');
const { getConfig } = require('./config');

let driver = null;
let wdOpts = null;

/**
 * Initialize WebDriver options from config
 */
function initializeOptions() {
  if (wdOpts) return wdOpts;

  const config = getConfig();
  const capabilities = {};

  // Prepare capabilities with appium: prefix
  for (const [key, value] of Object.entries(config.capabilities || {})) {
    capabilities[key === 'platformName' ? key : `appium:${key}`] = value;
  }

  wdOpts = {
    ...config.webdriverio,
    path: config.webdriverio?.path || '/',
    connectionRetryTimeout: config.webdriverio?.connectionRetryTimeout || 120000,
    connectionRetryCount: config.webdriverio?.connectionRetryCount || 3,
    capabilities,
  };

  return wdOpts;
}

/**
 * Start a new Appium session
 */
async function startAppiumSession() {
  if (driver) {
    console.log('Session already active');
    return driver;
  }

  const opts = initializeOptions();
  const config = getConfig();

  console.log('Connecting to Appium server...');
  driver = await remote(opts);

  if (config.timeouts?.implicit) {
    await driver.setTimeout({ implicit: config.timeouts.implicit });
  }

  console.log('Appium session started successfully');
  return driver;
}

/**
 * Stop the current Appium session
 */
async function stopAppiumSession() {
  if (!driver) {
    console.log('No active session to stop');
    return;
  }

  console.log('Stopping Appium session...');
  await driver.deleteSession();
  driver = null;
  console.log('Appium session stopped successfully');
}

/**
 * Execute a command on the active session
 * @param {string} command - The command to execute
 * @returns {Promise<any>}
 */
async function executeCommand(command) {
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    let result;

    switch (command) {
      case 'tap':
        // Example: Tap at coordinates (500, 500)
        await driver.performActions([{
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: 500, y: 500 },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 100 },
            { type: 'pointerUp', button: 0 }
          ]
        }]);
        await driver.releaseActions();
        console.log('Tap executed');
        break;

      case 'swipe':
        // Example: Swipe from bottom to top
        const { width, height } = await driver.getWindowSize();
        await driver.performActions([{
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: width / 2, y: height * 0.8 },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 500 },
            { type: 'pointerMove', duration: 500, x: width / 2, y: height * 0.2 },
            { type: 'pointerUp', button: 0 }
          ]
        }]);
        await driver.releaseActions();
        console.log('Swipe executed');
        break;

      case 'getSource':
        result = await driver.getPageSource();
        console.log('Page source retrieved');
        break;

      case 'screenshot':
        result = await driver.takeScreenshot();
        console.log('Screenshot captured');
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    return result;
  } catch (error) {
    console.error(`Failed to execute command '${command}':`, error);
    throw error;
  }
}

/**
 * Get the current driver instance
 * @returns {object|null}
 */
function getDriver() {
  return driver;
}

/**
 * Build selector string based on strategy
 */
function buildSelector(selector, strategy) {
  const strategies = {
    xpath: `//${selector}`,
    id: `~${selector}`,
    class: `android.widget.${selector}`,
    text: `android=new UiSelector().text("${selector}")`
  };
  return strategies[strategy] || selector;
}

/**
 * Find an element by selector with optional wait time
 */
async function findElement(selector, strategy = 'xpath', waitTime = 0) {
  if (!driver) throw new Error('No active Appium session. Please start a session first.');

  const selectorString = buildSelector(selector, strategy);
  const element = await driver.$(selectorString);

  if (waitTime > 0) {
    await element.waitForExist({ timeout: waitTime });
  }

  return element;
}

/**
 * Perform action on element
 */
async function performElementAction(action, selector, strategy, waitTime, ...args) {
  const element = await findElement(selector, strategy, waitTime);
  const result = await element[action](...args);
  console.log(`${action} on element: ${selector}`);
  return result;
}

/**
 * Click on an element
 */
async function clickElement(selector, strategy = 'xpath', waitTime = 0) {
  return performElementAction('click', selector, strategy, waitTime);
}

/**
 * Send text to an element
 */
async function sendText(selector, text, strategy = 'xpath', waitTime = 0) {
  return performElementAction('setValue', selector, strategy, waitTime, text);
}

/**
 * Get element text
 */
async function getElementText(selector, strategy = 'xpath', waitTime = 0) {
  return performElementAction('getText', selector, strategy, waitTime);
}

module.exports = {
  startAppiumSession,
  stopAppiumSession,
  executeCommand,
  getDriver,
  findElement,
  clickElement,
  sendText,
  getElementText,
};
