const { KEYCODE, Actions, Helpers, SWIPE } = require('../src/shortcuts');

/**
 * Test Settings Script
 * - Unlock device with PIN 300416
 * - Open Settings app
 * - Scroll to bottom
 * - Find and click "About phone"
 * - Find IMEI
 * - Lock device
 *
 * @param {Object} appium - Appium wrapper object
 * @returns {Promise<Object>} Result object
 */
async function execute(appium) {
  try {
    console.log('=== Starting Settings Test Script ===');

    // Step 1: Unlock device
    console.log('\n[Step 1] Unlocking device...');
    const unlockResult = await unlockDevice(appium, '300416');
    console.log(`Unlock result: ${JSON.stringify(unlockResult)}`);

    if (!unlockResult.success) {
      return unlockResult;
    }

    // Step 2: Open Settings app
    console.log('\n[Step 2] Opening Settings app...');
    await appium.startActivity('com.android.settings', '.Settings');
    await appium.pause(2000);
    console.log('Settings app opened successfully');

    // Step 3: Scroll to bottom of screen
    console.log('\n[Step 3] Scrolling to bottom of Settings...');
    await scrollToBottom(appium);
    console.log('Scrolled to bottom successfully');

    // Step 4: Find and click "About phone"
    console.log('\n[Step 4] Looking for "About phone" option...');
    const aboutPhoneClicked = await findAndClickAboutPhone(appium);

    if (!aboutPhoneClicked) {
      return {
        success: false,
        message: 'Could not find "About phone" option'
      };
    }

    console.log('"About phone" clicked successfully');
    await appium.pause(1500);

    // Step 5: Find IMEI information
    console.log('\n[Step 5] Searching for IMEI information...');
    const imeiInfo = await findIMEI(appium);
    console.log(`IMEI search result: ${JSON.stringify(imeiInfo)}`);

    // Step 6: Lock device
    console.log('\n[Step 6] Locking device...');
    await appium.lock();
    console.log('Device locked successfully');

    console.log('\n=== Script Completed Successfully ===');

    return {
      success: true,
      message: 'Settings test completed successfully',
      data: {
        imeiInfo
      }
    };

  } catch (error) {
    console.error(`\nError occurred: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);

    // Try to lock device even if error occurred
    try {
      console.log('Attempting to lock device after error...');
      await appium.lock();
    } catch (lockError) {
      console.error(`Failed to lock device: ${lockError.message}`);
    }

    return {
      success: false,
      message: `Script failed: ${error.message}`,
      error: error.stack
    };
  }
}

/**
 * Unlock device with PIN
 * @param {Object} appium - Appium wrapper object
 * @param {string} pin - PIN code to enter
 * @returns {Promise<Object>} Result object
 */
async function unlockDevice(appium, pin) {
  try {
    // Check if already unlocked
    const locked = await appium.isLocked();
    console.log(`Device locked status: ${locked}`);

    if (!locked) {
      console.log('Device is already unlocked');
      return {
        success: true,
        message: 'Device is already unlocked'
      };
    }

    // Wake up the device (press POWER key)
    console.log('Pressing POWER button to wake up device...');
    await appium.execute('mobile: pressKey', { keycode: KEYCODE.POWER });
    await appium.pause(500);

    // Swipe up to show lock screen
    console.log('Swiping up to show lock screen...');
    const coords = await Helpers.getSwipeCoordinates(appium, SWIPE.UP, 0.6);
    const swipeAction = Actions.swipe(coords.startX, coords.startY, coords.endX, coords.endY);
    await appium.performActions([swipeAction]);
    await appium.releaseActions();
    await appium.pause(1000);

    // Enter PIN: 300416
    console.log(`Entering PIN: ${pin}...`);
    for (const digit of pin) {
      console.log(`  Tapping digit: ${digit}`);
      const digitSelector = `android=new UiSelector().text("${digit}")`;
      const digitElement = await appium.$(digitSelector);

      const exists = await digitElement.waitForExist({ timeout: 3000 });
      if (!exists) {
        throw new Error(`Could not find digit button: ${digit}`);
      }

      await digitElement.click();
      await appium.pause(200);
    }

    console.log('PIN entered, looking for Enter/OK button...');

    // Look for and click Enter/OK button
    try {
      // Try common button texts
      const buttonTexts = ['Enter', 'OK', '确认', '确定', 'Done'];
      let buttonClicked = false;

      for (const buttonText of buttonTexts) {
        try {
          const enterButton = await appium.$(`android=new UiSelector().text("${buttonText}")`);
          const exists = await enterButton.isExisting();

          if (exists) {
            console.log(`Found button: "${buttonText}", clicking...`);
            await enterButton.click();
            buttonClicked = true;
            break;
          }
        } catch (e) {
          // Continue to next button text
        }
      }

      if (!buttonClicked) {
        // Try pressing Enter key as fallback
        console.log('No Enter button found, pressing ENTER keycode...');
        await appium.pressKeyCode(KEYCODE.ENTER);
      }
    } catch (e) {
      console.log('Enter button search failed, pressing ENTER keycode...');
      await appium.pressKeyCode(KEYCODE.ENTER);
    }

    await appium.pause(2000);

    // Verify unlock was successful
    const stillLocked = await appium.isLocked();
    console.log(`Device locked status after unlock attempt: ${stillLocked}`);

    if (stillLocked) {
      return {
        success: false,
        message: 'Failed to unlock device - device is still locked'
      };
    }

    return {
      success: true,
      message: 'Device unlocked successfully'
    };

  } catch (error) {
    console.error(`Unlock error: ${error.message}`);
    return {
      success: false,
      message: `Failed to unlock device: ${error.message}`
    };
  }
}

/**
 * Scroll to bottom of current screen
 * @param {Object} appium - Appium wrapper object
 */
async function scrollToBottom(appium) {
  console.log('Starting scroll to bottom...');

  // Perform multiple swipes to reach the bottom
  const scrollCount = 5; // Number of swipes to perform

  for (let i = 0; i < scrollCount; i++) {
    console.log(`  Scroll ${i + 1}/${scrollCount}...`);
    const coords = await Helpers.getSwipeCoordinates(appium, SWIPE.UP, 0.6);
    const swipeAction = Actions.swipe(coords.startX, coords.startY, coords.endX, coords.endY, 300);

    await appium.performActions([swipeAction]);
    await appium.releaseActions();
    await appium.pause(500);
  }

  console.log('Finished scrolling to bottom');
}

/**
 * Find and click "About phone" option
 * @param {Object} appium - Appium wrapper object
 * @returns {Promise<boolean>} True if found and clicked
 */
async function findAndClickAboutPhone(appium) {
  console.log('Searching for "About phone" option...');

  // Try different possible text variations
  const possibleTexts = [
    'About phone',
    'About device',
    'About',
    '关于手机',
    '关于本机',
    '关于设备'
  ];

  for (const text of possibleTexts) {
    try {
      console.log(`  Trying text: "${text}"`);

      // Try UiSelector text match
      const element = await appium.$(`android=new UiSelector().textContains("${text}")`);
      const exists = await element.isExisting();

      if (exists) {
        console.log(`  Found element with text: "${text}"`);
        const elementText = await element.getText();
        console.log(`  Element actual text: "${elementText}"`);

        await element.click();
        console.log(`  Clicked successfully`);
        return true;
      }
    } catch (e) {
      console.log(`  Not found with text: "${text}"`);
    }
  }

  // If not found by text, try to get page source and search
  console.log('Text search failed, getting page source...');
  try {
    const pageSource = await appium.getPageSource();
    console.log(`Page source length: ${pageSource.length} characters`);

    // Check if About phone exists in page source
    const aboutPhoneInSource = pageSource.includes('About') ||
                               pageSource.includes('关于');
    console.log(`"About" found in page source: ${aboutPhoneInSource}`);

    if (aboutPhoneInSource) {
      // Try clicking by resource-id or other attributes
      const resourceIds = [
        'android:id/title',
        'com.android.settings:id/title'
      ];

      for (const resId of resourceIds) {
        try {
          const elements = await appium.$$(`android=new UiSelector().resourceId("${resId}")`);
          console.log(`Found ${elements.length} elements with resource ID: ${resId}`);

          for (const elem of elements) {
            const text = await elem.getText();
            console.log(`  Element text: "${text}"`);

            if (text && (text.includes('About') || text.includes('关于'))) {
              console.log(`  Clicking element with matching text`);
              await elem.click();
              return true;
            }
          }
        } catch (e) {
          console.log(`  Failed to find elements with resource ID: ${resId}`);
        }
      }
    }
  } catch (e) {
    console.error(`Failed to get page source: ${e.message}`);
  }

  console.log('Could not find "About phone" option');
  return false;
}

/**
 * Find IMEI information on the screen
 * @param {Object} appium - Appium wrapper object
 * @returns {Promise<Object>} IMEI information
 */
async function findIMEI(appium) {
  console.log('Starting IMEI search...');

  try {
    // First, try scrolling down a bit to find IMEI
    console.log('Scrolling to find IMEI...');
    for (let i = 0; i < 3; i++) {
      console.log(`  Scroll ${i + 1}/3...`);
      const coords = await Helpers.getSwipeCoordinates(appium, SWIPE.UP, 0.4);
      const swipeAction = Actions.swipe(coords.startX, coords.startY, coords.endX, coords.endY, 300);

      await appium.performActions([swipeAction]);
      await appium.releaseActions();
      await appium.pause(500);
    }

    // Get page source
    console.log('Getting page source to search for IMEI...');
    const pageSource = await appium.getPageSource();

    // Search for IMEI in page source
    const imeiPattern = /IMEI[^<]*?(\d{15})/gi;
    const imeiMatches = pageSource.match(imeiPattern);

    if (imeiMatches && imeiMatches.length > 0) {
      console.log(`Found IMEI in page source: ${imeiMatches.join(', ')}`);

      return {
        found: true,
        imei: imeiMatches,
        message: `Found ${imeiMatches.length} IMEI(s)`
      };
    }

    // Try to find IMEI elements
    console.log('Searching for IMEI elements...');
    const possibleTexts = ['IMEI', 'IMEI 1', 'IMEI 2', 'IMEI1', 'IMEI2'];
    const foundIMEIs = [];

    for (const text of possibleTexts) {
      try {
        const element = await appium.$(`android=new UiSelector().textContains("${text}")`);
        const exists = await element.isExisting();

        if (exists) {
          const elementText = await element.getText();
          console.log(`Found IMEI element: "${elementText}"`);
          foundIMEIs.push(elementText);
        }
      } catch (e) {
        // Continue searching
      }
    }

    if (foundIMEIs.length > 0) {
      console.log(`Found ${foundIMEIs.length} IMEI element(s)`);
      return {
        found: true,
        imei: foundIMEIs,
        message: `Found ${foundIMEIs.length} IMEI element(s)`
      };
    }

    // Check if IMEI text exists in page source
    const hasIMEIText = pageSource.toLowerCase().includes('imei');
    console.log(`IMEI text found in page source: ${hasIMEIText}`);

    return {
      found: hasIMEIText,
      imei: null,
      message: hasIMEIText ? 'IMEI text found in page but could not extract value' : 'IMEI not found',
      pageSourceLength: pageSource.length
    };

  } catch (error) {
    console.error(`IMEI search error: ${error.message}`);
    return {
      found: false,
      imei: null,
      message: `Error searching for IMEI: ${error.message}`
    };
  }
}

module.exports = {
  name: 'Test Settings',
  config: {
    pin: '300416',
  },
  execute
};
