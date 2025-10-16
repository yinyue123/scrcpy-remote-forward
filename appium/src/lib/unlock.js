const { getDriver } = require('./appium');
const { getConfig } = require('./config');

/**
 * Check if device is locked
 * @returns {Promise<boolean>}
 */
async function isDeviceLocked() {
  const driver = getDriver();
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    const locked = await driver.isLocked();
    console.log(`Device locked status: ${locked}`);
    return locked;
  } catch (error) {
    console.error('Failed to check lock status:', error);
    throw error;
  }
}

/**
 * Lock the device
 * @returns {Promise<void>}
 */
async function lockDevice() {
  const driver = getDriver();
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    console.log('Locking device...');
    await driver.lock();
    console.log('Device locked successfully');
  } catch (error) {
    console.error('Failed to lock device:', error);
    throw error;
  }
}

/**
 * Unlock the device
 * @param {string} unlockType - Type of unlock (pin, password, pattern, fingerprint)
 * @param {string} unlockKey - The unlock key/password/pattern
 * @returns {Promise<void>}
 */
async function unlockDevice(unlockType = null, unlockKey = null) {
  const driver = getDriver();
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    const config = getConfig();
    // Use config values if not provided
    const type = unlockType || config.device?.unlockType || 'pin';
    const key = unlockKey || config.device?.unlockKey || '1234';

    console.log(`Unlocking device with ${type}...`);

    // Check if already unlocked
    const locked = await isDeviceLocked();
    if (!locked) {
      console.log('Device is already unlocked');
      return;
    }

    // Wake up the device first
    await driver.execute('mobile: pressKey', { keycode: 26 }); // KEYCODE_POWER
    await driver.pause(500);

    // Swipe up to show lock screen
    const { width, height } = await driver.getWindowSize();
    await driver.touchAction([
      { action: 'press', x: width / 2, y: height * 0.8 },
      { action: 'wait', ms: 100 },
      { action: 'moveTo', x: width / 2, y: height * 0.2 },
      'release',
    ]);
    await driver.pause(500);

    // Enter unlock credentials based on type
    switch (type) {
      case 'pin':
      case 'password':
        await enterPassword(key);
        break;
      case 'pattern':
        await drawPattern(key);
        break;
      case 'fingerprint':
        await simulateFingerprint();
        break;
      default:
        throw new Error(`Unsupported unlock type: ${type}`);
    }

    console.log('Device unlocked successfully');
  } catch (error) {
    console.error('Failed to unlock device:', error);
    throw error;
  }
}

/**
 * Enter password or PIN
 * @param {string} password - The password or PIN to enter
 * @returns {Promise<void>}
 */
async function enterPassword(password) {
  const driver = getDriver();
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    console.log('Entering password/PIN...');

    // For PIN, tap each digit
    if (/^\d+$/.test(password)) {
      for (const digit of password) {
        // Find and click the digit button
        const digitSelector = `android=new UiSelector().text("${digit}")`;
        const digitElement = await driver.$(digitSelector);
        await digitElement.waitForExist({ timeout: 3000 });
        await digitElement.click();
        await driver.pause(200);
      }

      // Look for and click Enter/OK button
      try {
        const enterButton = await driver.$('android=new UiSelector().text("Enter")');
        if (await enterButton.isExisting()) {
          await enterButton.click();
        } else {
          // Try pressing Enter key
          await driver.pressKeyCode(66); // KEYCODE_ENTER
        }
      } catch (e) {
        // Try pressing Enter key as fallback
        await driver.pressKeyCode(66); // KEYCODE_ENTER
      }
    } else {
      // For text password, find input field and enter text
      const passwordField = await driver.$('android.widget.EditText');
      await passwordField.waitForExist({ timeout: 3000 });
      await passwordField.setValue(password);
      await driver.pressKeyCode(66); // KEYCODE_ENTER
    }

    await driver.pause(1000);
    console.log('Password entered successfully');
  } catch (error) {
    console.error('Failed to enter password:', error);
    throw error;
  }
}

/**
 * Draw unlock pattern
 * @param {string} pattern - Pattern as string (e.g., "123-456-789")
 * @returns {Promise<void>}
 */
async function drawPattern(pattern) {
  const driver = getDriver();
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    console.log('Drawing unlock pattern...');

    // This is a simplified implementation
    // In reality, you'd need to calculate the coordinates of pattern dots
    // and perform a swipe gesture through them

    const { width, height } = await driver.getWindowSize();
    const centerX = width / 2;
    const centerY = height / 2;

    // Example: Simple swipe pattern (customize based on your pattern)
    await driver.touchAction([
      { action: 'press', x: centerX - 100, y: centerY - 100 },
      { action: 'wait', ms: 100 },
      { action: 'moveTo', x: centerX, y: centerY - 100 },
      { action: 'wait', ms: 100 },
      { action: 'moveTo', x: centerX + 100, y: centerY - 100 },
      'release',
    ]);

    await driver.pause(1000);
    console.log('Pattern drawn successfully');
  } catch (error) {
    console.error('Failed to draw pattern:', error);
    throw error;
  }
}

/**
 * Simulate fingerprint authentication
 * @param {number} fingerprintId - Fingerprint ID (default: 1)
 * @returns {Promise<void>}
 */
async function simulateFingerprint(fingerprintId = 1) {
  const driver = getDriver();
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    console.log('Simulating fingerprint authentication...');

    // This requires the device to be an emulator with fingerprint configured
    await driver.execute('mobile: fingerprint', { fingerprintId });

    await driver.pause(1000);
    console.log('Fingerprint authenticated successfully');
  } catch (error) {
    console.error('Failed to simulate fingerprint:', error);
    throw error;
  }
}

/**
 * Input password in a specific field
 * @param {string} selector - Element selector
 * @param {string} password - Password to input
 * @param {string} strategy - Selector strategy
 * @param {number} waitTime - Wait time in milliseconds
 * @returns {Promise<void>}
 */
async function inputPassword(selector, password, strategy = 'xpath', waitTime = 5000) {
  const driver = getDriver();
  if (!driver) {
    throw new Error('No active Appium session. Please start a session first.');
  }

  try {
    console.log(`Inputting password to element: ${selector}`);

    let selectorString;
    switch (strategy) {
      case 'xpath':
        selectorString = `//${selector}`;
        break;
      case 'id':
        selectorString = `~${selector}`;
        break;
      case 'text':
        selectorString = `android=new UiSelector().text("${selector}")`;
        break;
      default:
        selectorString = selector;
    }

    const element = await driver.$(selectorString);

    if (waitTime > 0) {
      await element.waitForExist({ timeout: waitTime });
    }

    await element.click();
    await driver.pause(300);
    await element.setValue(password);

    console.log('Password inputted successfully');
  } catch (error) {
    console.error('Failed to input password:', error);
    throw error;
  }
}

module.exports = {
  isDeviceLocked,
  lockDevice,
  unlockDevice,
  enterPassword,
  drawPattern,
  simulateFingerprint,
  inputPassword,
};
