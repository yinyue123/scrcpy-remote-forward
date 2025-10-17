const { KEYCODE, Actions, Helpers, SWIPE } = require('../src/shortcuts');

/**
 * Demo Script
 * @param {Object} appium - Appium wrapper object
 * @returns {Promise<Object>} Result object
 */
async function execute(appium) {
  try {
    appium.log('=== Starting Demo Script ===');

    // Step 1: Unlock device
    appium.log('\n[Step 1] Unlocking device...');
    const unlockResult = await toggleDeviceLock(appium, false, '123456');
    appium.log(`Unlock result: ${JSON.stringify(unlockResult)}`);

    if (!unlockResult.success) {
      return unlockResult;
    }

    // Step 2: Turn on VPN
    appium.log('\n[Step 2] Turning on VPN...');
    const vpnOnResult = await toggleVPN(appium, true);
    appium.log(`VPN on result: ${JSON.stringify(vpnOnResult)}`);

    if (!vpnOnResult.success) {
      return vpnOnResult;
    }

    // Step 3: Query Gemini about stock prices
    appium.log('\n[Step 3] Querying Gemini about stock prices...');
    const geminiResult = await queryGemini(appium, '今天股价涨了没?');
    appium.log(`Gemini result: ${JSON.stringify(geminiResult)}`);

    if (geminiResult.success) {
      appium.log(`Gemini response: ${geminiResult.response}`);
    } else {
      appium.log(`Gemini query failed: ${geminiResult.message}`);
    }

    // Step 4: Turn off VPN
    appium.log('\n[Step 4] Turning off VPN...');
    const vpnOffResult = await toggleVPN(appium, false);
    appium.log(`VPN off result: ${JSON.stringify(vpnOffResult)}`);

    if (!vpnOffResult.success) {
      return vpnOffResult;
    }

    // Step 5: Lock device
    appium.log('\n[Step 5] Locking device...');
    const lockResult = await toggleDeviceLock(appium, true);
    appium.log(`Lock result: ${JSON.stringify(lockResult)}`);

    if (!lockResult.success) {
      return lockResult;
    }

    appium.log('\n=== Script Completed Successfully ===');

    return {
      success: true,
      message: 'Demo completed successfully',
      geminiResponse: geminiResult.response || 'No response'
    };

  } catch (error) {
    appium.err(`\nError occurred: ${error.message}`);
    appium.err(`Stack trace: ${error.stack}`);

    // Try to lock device even if error occurred
    try {
      appium.log('Attempting to lock device after error...');
      await toggleDeviceLock(appium, true);
    } catch (lockError) {
      appium.err(`Failed to lock device: ${lockError.message}`);
    }

    return {
      success: false,
      message: `Script failed: ${error.message}`,
      error: error.stack
    };
  }
}

/**
 * Toggle device lock state (lock or unlock)
 */
async function toggleDeviceLock(appium, shouldLock, pin = null) {
  try {
    const locked = await appium.isLocked();
    appium.log(`Device locked status: ${locked}`);

    // If locking the device
    if (shouldLock) {
      if (locked) {
        appium.log('Device is already locked');
        return { success: true, message: 'Device is already locked' };
      }

      appium.log('Locking device...');
      await appium.lock();
      await appium.pause(500);

      const nowLocked = await appium.isLocked();
      if (!nowLocked) {
        return { success: false, message: 'Failed to lock device' };
      }

      return { success: true, message: 'Device locked successfully' };
    }

    // If unlocking the device
    if (!locked) {
      appium.log('Device is already unlocked');
      return { success: true, message: 'Device is already unlocked' };
    }

    if (!pin) {
      throw new Error('PIN is required for unlocking device');
    }

    // Call unlock interface
    appium.log('Calling unlock interface...');
    await appium.unlock();
    await appium.pause(500);

    // Swipe up to show lock screen
    appium.log('Swiping up to show lock screen...');
    const coords = await Helpers.getSwipeCoordinates(appium, SWIPE.UP, 0.6);
    const swipeAction = Actions.swipe(coords.startX, coords.startY, coords.endX, coords.endY);
    await appium.performActions([swipeAction]);
    await appium.releaseActions();
    await appium.pause(500);

    // Wait for PIN entry screen
    appium.log('Waiting for PIN entry screen...');
    const pinEntrySelector = 'android=new UiSelector().resourceId("com.android.systemui:id/pinEntry")';
    const pinEntryElement = await appium.$(pinEntrySelector);
    const pinEntryExists = await pinEntryElement.waitForExist({ timeout: 5000 });

    if (!pinEntryExists) {
      appium.log('Warning: pinEntry element not found, but continuing to enter PIN...');
    } else {
      appium.log('PIN entry screen detected');
    }

    // Enter PIN using resource IDs
    appium.log(`Entering PIN: ${pin}...`);
    for (const digit of pin) {
      appium.log(`  Tapping digit: ${digit}`);
      const keyResourceId = `com.android.systemui:id/key${digit}`;
      const digitSelector = `android=new UiSelector().resourceId("${keyResourceId}")`;
      const digitElement = await appium.$(digitSelector);

      const exists = await digitElement.waitForExist({ timeout: 3000 });
      if (!exists) {
        throw new Error(`Could not find digit button with resource ID: ${keyResourceId}`);
      }

      await digitElement.click();
      await appium.pause(50);
    }

    // Click Enter button
    appium.log('PIN entered, clicking Enter button...');
    const enterResourceId = 'com.android.systemui:id/key_enter';
    const enterSelector = `android=new UiSelector().resourceId("${enterResourceId}")`;
    const enterElement = await appium.$(enterSelector);

    const enterExists = await enterElement.waitForExist({ timeout: 3000 });
    if (!enterExists) {
      throw new Error(`Could not find Enter button with resource ID: ${enterResourceId}`);
    }

    await enterElement.click();
    await appium.pause(2000);

    // Verify unlock was successful
    const stillLocked = await appium.isLocked();
    appium.log(`Device locked status after unlock attempt: ${stillLocked}`);

    if (stillLocked) {
      return { success: false, message: 'Failed to unlock device - device is still locked' };
    }

    return { success: true, message: 'Device unlocked successfully' };

  } catch (error) {
    appium.err(`Toggle lock error: ${error.message}`);
    return { success: false, message: `Failed to toggle device lock: ${error.message}` };
  }
}

/**
 * Toggle VPN connection (connect or disconnect)
 */
async function toggleVPN(appium, shouldConnect) {
  // Internal helper functions
  const clickFabButton = async () => {
    const fabSelector = 'android=new UiSelector().resourceId("com.v2ray.ang:id/fab")';
    const fabElement = await appium.$(fabSelector);
    const fabExists = await fabElement.waitForExist({ timeout: 3000 });
    if (!fabExists) throw new Error('Could not find FAB button');
    await fabElement.click();
  };

  const waitForStatus = async (expectedStatus, timeout) => {
    const startTime = Date.now();
    const statusSelector = 'android=new UiSelector().resourceId("com.v2ray.ang:id/tv_test_state")';

    while (Date.now() - startTime < timeout) {
      try {
        const statusElement = await appium.$(statusSelector);
        const statusExists = await statusElement.waitForExist({ timeout: 1000 });
        if (statusExists) {
          const currentStatus = await statusElement.getText();
          appium.log(`  Current status: ${currentStatus}`);
          if (currentStatus === expectedStatus) return true;
        }
      } catch (e) {
        // Continue waiting
      }
      await appium.pause(500);
    }
    return false;
  };

  const waitForStatusContains = async (expectedText, timeout) => {
    const startTime = Date.now();
    const statusSelector = 'android=new UiSelector().resourceId("com.v2ray.ang:id/tv_test_state")';

    while (Date.now() - startTime < timeout) {
      try {
        const statusElement = await appium.$(statusSelector);
        const statusExists = await statusElement.waitForExist({ timeout: 1000 });
        if (statusExists) {
          const currentStatus = await statusElement.getText();
          appium.log(`  Current status: ${currentStatus}`);
          if (currentStatus.includes(expectedText)) return true;
        }
      } catch (e) {
        // Continue waiting
      }
      await appium.pause(500);
    }
    return false;
  };

  const testVPNConnection = async () => {
    try {
      appium.log('Testing VPN connection...');
      const statusSelector = 'android=new UiSelector().resourceId("com.v2ray.ang:id/tv_test_state")';
      const statusElement = await appium.$(statusSelector);

      const statusExists = await statusElement.waitForExist({ timeout: 3000 });
      if (!statusExists) throw new Error('Could not find status element for testing');

      await statusElement.click();
      appium.log('Clicked test button, waiting for test result (timeout: 20 seconds)...');

      const startTime = Date.now();
      const testTimeout = 20000;

      while (Date.now() - startTime < testTimeout) {
        await appium.pause(1000);
        const currentStatus = await statusElement.getText();
        appium.log(`  Test status: ${currentStatus}`);

        if (currentStatus.includes('连接成功')) {
          appium.log('Connection test successful!');
          return { success: true, message: 'VPN connection test passed' };
        }

        if (currentStatus.includes('失败') || currentStatus.includes('错误')) {
          return { success: false, message: `VPN connection test failed: ${currentStatus}` };
        }
      }

      return { success: false, message: 'VPN connection test timeout' };
    } catch (error) {
      appium.err(`Test VPN error: ${error.message}`);
      return { success: false, message: `Failed to test VPN connection: ${error.message}` };
    }
  };

  // Main VPN toggle logic
  try {
    appium.log(`${shouldConnect ? 'Connecting' : 'Disconnecting'} VPN...`);

    // Open V2RayNG app
    appium.log('Opening V2RayNG app...');
    await appium.startActivity('com.v2ray.ang', '.ui.MainActivity');
    await appium.pause(1000);

    // Wait for the connection status element to appear
    appium.log('Waiting for connection status element...');
    const statusSelector = 'android=new UiSelector().resourceId("com.v2ray.ang:id/tv_test_state")';
    const statusElement = await appium.$(statusSelector);
    const statusExists = await statusElement.waitForExist({ timeout: 5000 });

    if (!statusExists) {
      throw new Error('Could not find connection status element (tv_test_state)');
    }

    // Get current connection status
    const currentStatus = await statusElement.getText();
    appium.log(`Current VPN status: ${currentStatus}`);

    if (shouldConnect) {
      // Connect VPN
      if (currentStatus !== '未连接') {
        appium.log('VPN is already connected, verifying connection...');
        const testResult = await testVPNConnection();
        if (testResult.success) {
          return { success: true, message: 'VPN is already connected and verified' };
        } else {
          appium.log('VPN shows connected but test failed, reconnecting...');
          await clickFabButton();
          await waitForStatus('未连接', 5000);
          await appium.pause(500);
        }
      }

      // Click FAB button to connect
      appium.log('Clicking FAB button to connect...');
      await appium.pause(500);
      await clickFabButton();

      // Wait for connection to establish
      appium.log('Waiting for VPN to connect (timeout: 20 seconds)...');
      const connected = await waitForStatusContains('已连接', 20000);

      if (!connected) {
        return { success: false, message: 'VPN connection timeout - status did not show "已连接"' };
      }

      appium.log('VPN connected, testing connection...');
      const testResult = await testVPNConnection();

      if (!testResult.success) {
        return { success: false, message: 'VPN connected but connection test failed' };
      }

      appium.log('Pressing HOME button to return to home screen...');
      await appium.pressKeyCode(KEYCODE.HOME);
      await appium.pause(1000);

      return { success: true, message: 'VPN connected and verified successfully' };

    } else {
      // Disconnect VPN
      if (currentStatus === '未连接') {
        appium.log('VPN is already disconnected');
        appium.log('Pressing HOME button to return to home screen...');
        await appium.pressKeyCode(KEYCODE.HOME);
        await appium.pause(1000);
        return { success: true, message: 'VPN is already disconnected' };
      }

      // Click FAB button to disconnect
      appium.log('Clicking FAB button to disconnect...');
      await clickFabButton();

      // Wait for disconnection
      appium.log('Waiting for VPN to disconnect...');
      const disconnected = await waitForStatus('未连接', 10000);

      if (!disconnected) {
        return { success: false, message: 'VPN disconnection timeout - status did not show "未连接"' };
      }

      appium.log('Pressing HOME button to return to home screen...');
      await appium.pressKeyCode(KEYCODE.HOME);
      await appium.pause(1000);

      return { success: true, message: 'VPN disconnected successfully' };
    }

  } catch (error) {
    appium.err(`Toggle VPN error: ${error.message}`);
    return { success: false, message: `Failed to toggle VPN: ${error.message}` };
  }
}

/**
 * Query Gemini with optional image upload
 */
async function queryGemini(appium, queryText, albumName = '', imageIndex = -1) {
  // Internal helper functions
  const findAndClickAlbum = async (albumName) => {
    let previousAlbumNames = [];
    let unchangedCount = 0;
    const maxUnchangedAttempts = 3;

    while (unchangedCount < maxUnchangedAttempts) {
      const albumNamesSelector = 'android=new UiSelector().resourceId("com.google.android.providers.media.module:id/album_name")';
      const albumElements = await appium.$$(albumNamesSelector);

      if (albumElements.length === 0) {
        appium.log('No albums found');
        return false;
      }

      const currentAlbumNames = [];
      for (const element of albumElements) {
        const text = await element.getText();
        currentAlbumNames.push(text);
        appium.log(`  Found album: "${text}"`);

        if (text === albumName) {
          appium.log(`Found target album: "${albumName}"`);
          await element.click();
          return true;
        }
      }

      const namesChanged = JSON.stringify(currentAlbumNames) !== JSON.stringify(previousAlbumNames);

      if (!namesChanged && previousAlbumNames.length > 0) {
        unchangedCount++;
        appium.log(`Album list unchanged (${unchangedCount}/${maxUnchangedAttempts})`);
      } else {
        unchangedCount = 0;
      }

      if (unchangedCount >= maxUnchangedAttempts) {
        appium.log('Reached bottom of album list, album not found');
        return false;
      }

      previousAlbumNames = currentAlbumNames;

      appium.log('Scrolling down to find more albums...');
      const coords = await Helpers.getSwipeCoordinates(appium, SWIPE.UP, 0.5);
      const swipeAction = Actions.swipe(coords.startX, coords.startY, coords.endX, coords.endY, 300);
      await appium.performActions([swipeAction]);
      await appium.releaseActions();
      await appium.pause(1000);
    }

    return false;
  };

  const selectImageByIndex = async (imageIndex) => {
    try {
      const checkboxSelector = 'android=new UiSelector().resourceId("com.google.android.providers.media.module:id/icon_check")';
      const checkboxElements = await appium.$$(checkboxSelector);

      appium.log(`Found ${checkboxElements.length} images`);

      if (imageIndex >= checkboxElements.length) {
        appium.err(`Image index ${imageIndex} out of range (found ${checkboxElements.length} images)`);
        return false;
      }

      await checkboxElements[imageIndex].click();
      appium.log(`Selected image at index ${imageIndex}`);
      await appium.pause(500);

      return true;
    } catch (error) {
      appium.err(`Error selecting image: ${error.message}`);
      return false;
    }
  };

  const getGeminiResponse = async () => {
    try {
      const chatHistorySelector = 'android=new UiSelector().resourceId("com.google.android.googlequicksearchbox:id/assistant_robin_chat_history_list")';
      const chatHistory = await appium.$(chatHistorySelector);

      const chatHistoryExists = await chatHistory.waitForExist({ timeout: 5000 });
      if (!chatHistoryExists) {
        throw new Error('Could not find chat history');
      }

      const responseTextSelector = 'android=new UiSelector().resourceId("com.google.android.googlequicksearchbox:id/assistant_robin_text")';
      const responseElements = await appium.$$(responseTextSelector);

      if (responseElements.length === 0) {
        throw new Error('No response elements found');
      }

      const lastResponseElement = responseElements[responseElements.length - 1];
      const responseText = await lastResponseElement.getText();

      return responseText;
    } catch (error) {
      appium.err(`Error getting response: ${error.message}`);
      return null;
    }
  };

  // Main Gemini query logic
  try {
    appium.log(`Querying Gemini: "${queryText}"`);
    if (albumName && imageIndex >= 0) {
      appium.log(`With image from album: "${albumName}", index: ${imageIndex}`);
    }

    // Open Gemini app using search
    appium.log('Opening Gemini app...');
    const openResult = await openAppBySearch(appium, 'Gemini');
    if (!openResult.success) {
      throw new Error(`Failed to open Gemini: ${openResult.message}`);
    }
    await appium.pause(2000);

    // Click on input field
    appium.log('Clicking on input field...');
    const inputSelector = 'android=new UiSelector().resourceId("com.google.android.googlequicksearchbox:id/assistant_robin_input_collapsed_text_half_sheet")';
    const inputElement = await appium.$(inputSelector);
    const inputExists = await inputElement.waitForExist({ timeout: 5000 });

    if (!inputExists) {
      throw new Error('Could not find input field');
    }

    await inputElement.click();
    await appium.pause(500);

    // Enter query text
    appium.log('Entering query text...');
    await inputElement.setValue(queryText);
    await appium.pause(1000);

    // Upload image if required
    if (albumName && imageIndex >= 0) {
      appium.log('Uploading image...');

      // Click attachment button
      appium.log('Clicking attachment button...');
      const attachmentSelector = 'android=new UiSelector().resourceId("com.google.android.googlequicksearchbox:id/assistant_robin_chat_input_attachment_btn")';
      const attachmentBtn = await appium.$(attachmentSelector);
      const attachmentExists = await attachmentBtn.waitForExist({ timeout: 5000 });

      if (!attachmentExists) {
        throw new Error('Could not find attachment button');
      }

      await attachmentBtn.click();
      await appium.pause(1500);

      // Click "图库" (Gallery)
      appium.log('Looking for "图库" (Gallery) option...');
      const gallerySelector = 'android=new UiSelector().text("图库")';
      const galleryElement = await appium.$(gallerySelector);
      const galleryExists = await galleryElement.waitForExist({ timeout: 5000 });

      if (!galleryExists) {
        throw new Error('Could not find "图库" (Gallery) option');
      }

      await galleryElement.click();
      await appium.pause(2000);

      // Click "相册" (Albums)
      appium.log('Looking for "相册" (Albums) option...');
      const albumsSelector = 'android=new UiSelector().text("相册")';
      const albumsElement = await appium.$(albumsSelector);
      const albumsExists = await albumsElement.waitForExist({ timeout: 5000 });

      if (!albumsExists) {
        throw new Error('Could not find "相册" (Albums) option');
      }

      await albumsElement.click();
      await appium.pause(2000);

      // Find target album
      appium.log(`Looking for album: "${albumName}"...`);
      const albumFound = await findAndClickAlbum(albumName);

      if (!albumFound) {
        throw new Error(`Could not find album: "${albumName}"`);
      }

      await appium.pause(1500);

      // Select image by index
      appium.log(`Selecting image at index: ${imageIndex}...`);
      const imageSelected = await selectImageByIndex(imageIndex);

      if (!imageSelected) {
        throw new Error(`Could not select image at index: ${imageIndex}`);
      }

      // Click Add button
      appium.log('Clicking Add button...');
      const addButtonSelector = 'android=new UiSelector().resourceId("com.google.android.providers.media.module:id/button_add")';
      const addButton = await appium.$(addButtonSelector);
      const addButtonExists = await addButton.waitForExist({ timeout: 5000 });

      if (!addButtonExists) {
        throw new Error('Could not find Add button');
      }

      await addButton.click();
      appium.log('Waiting for image to upload (10 seconds)...');
      await appium.pause(10000);
    }

    // Click send button
    appium.log('Clicking send button...');
    const sendButtonSelector = 'android=new UiSelector().resourceId("com.google.android.googlequicksearchbox:id/assistant_robin_send_button")';
    const sendButton = await appium.$(sendButtonSelector);
    const sendButtonExists = await sendButton.waitForExist({ timeout: 5000 });

    if (!sendButtonExists) {
      throw new Error('Could not find send button');
    }

    await sendButton.click();
    await appium.pause(2000);

    // Handle review popup if it appears
    appium.log('Checking for review popup...');
    try {
      const reviewPopupSelector = 'android=new UiSelector().resourceId("com.google.android.googlequicksearchbox:id/0_resource_name_obfuscated").textContains("评价会公开显示")';
      const reviewPopup = await appium.$(reviewPopupSelector);
      const reviewPopupExists = await reviewPopup.waitForExist({ timeout: 3000 });

      if (reviewPopupExists) {
        appium.log('Review popup detected, clicking "以后再说"...');
        const laterButtonSelector = 'android=new UiSelector().text("以后再说")';
        const laterButton = await appium.$(laterButtonSelector);
        const laterButtonExists = await laterButton.waitForExist({ timeout: 3000 });

        if (laterButtonExists) {
          await laterButton.click();
          await appium.pause(1000);
        }
      }
    } catch (e) {
      appium.log('No review popup appeared');
    }

    // Wait for response
    appium.log('Waiting for Gemini response (60 seconds)...');
    await appium.pause(60000);

    // Get response
    appium.log('Retrieving response...');
    const response = await getGeminiResponse();

    if (!response) {
      throw new Error('Could not retrieve Gemini response');
    }

    appium.log(`Gemini response: ${response}`);

    // Press HOME button to return to home screen
    appium.log('Pressing HOME button to return to home screen...');
    await appium.pressKeyCode(KEYCODE.HOME);
    await appium.pause(1000);

    return {
      success: true,
      message: 'Query completed successfully',
      response: response
    };

  } catch (error) {
    appium.err(`Query Gemini error: ${error.message}`);
    return {
      success: false,
      message: `Failed to query Gemini: ${error.message}`
    };
  }
}

/**
 * Open app by searching in launcher
 * @param {Object} appium - Appium wrapper object
 * @param {string} appName - The name of the app to search and open
 * @returns {Promise<Object>} Result object
 */
async function openAppBySearch(appium, appName) {
  try {
    appium.log(`Opening app by search: "${appName}"`);

    // Open Xperia Launcher
    appium.log('Opening Xperia Launcher...');
    await appium.startActivity('com.sonymobile.launcher', '.XperiaLauncher');
    await appium.pause(1000);

    // Click on search button
    appium.log('Clicking on search button...');
    const searchButtonSelector = 'android=new UiSelector().resourceId("com.android.launcher3:id/fallback_search_view")';
    const searchButton = await appium.$(searchButtonSelector);
    const searchButtonExists = await searchButton.waitForExist({ timeout: 5000 });

    if (!searchButtonExists) {
      throw new Error('Could not find search button (fallback_search_view)');
    }

    await searchButton.click();
    await appium.pause(1000);

    // Enter app name in search field
    appium.log(`Entering app name: "${appName}"...`);
    // The search field should be focused after clicking the search button
    await appium.execute('mobile: performEditorAction', { action: 'search' });
    await appium.pause(500);

    // Find and type in the search field
    const searchFieldSelector = 'android=new UiSelector().focused(true)';
    const searchField = await appium.$(searchFieldSelector);
    await searchField.setValue(appName);
    await appium.pause(1500);

    // Find the first TextView in RecyclerView
    appium.log('Looking for app in search results...');
    const recyclerViewSelector = 'android=new UiSelector().className("androidx.recyclerview.widget.RecyclerView")';
    const recyclerView = await appium.$(recyclerViewSelector);
    const recyclerViewExists = await recyclerView.waitForExist({ timeout: 5000 });

    if (!recyclerViewExists) {
      throw new Error('Could not find RecyclerView with search results');
    }

    // Find the first TextView inside RecyclerView
    const textViewSelector = 'android=new UiSelector().className("androidx.recyclerview.widget.RecyclerView").childSelector(new UiSelector().className("android.widget.TextView").instance(0))';
    const firstTextView = await appium.$(textViewSelector);
    const firstTextViewExists = await firstTextView.waitForExist({ timeout: 5000 });

    if (!firstTextViewExists) {
      throw new Error('Could not find app result in search results');
    }

    // Get the text to confirm
    const resultText = await firstTextView.getText();
    appium.log(`Found app result: "${resultText}"`);

    // Click on the first result
    appium.log('Clicking on first search result...');
    await firstTextView.click();
    await appium.pause(2000);

    appium.log(`Successfully opened app: "${appName}"`);

    return {
      success: true,
      message: `App "${appName}" opened successfully`,
      appResult: resultText
    };

  } catch (error) {
    appium.err(`Open app by search error: ${error.message}`);
    return {
      success: false,
      message: `Failed to open app "${appName}": ${error.message}`
    };
  }
}

module.exports = {
  name: 'Demo',
  config: {
    pin: '123456',
  },
  execute
};
