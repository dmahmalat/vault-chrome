/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* global browser chrome */

function storePathComponents(storePath, username) {
  let path = storePath;
  const pathComponents = path.split('/');
  const storeRoot = pathComponents[0];
  const storeSubPath =
    pathComponents.length > 0 ? pathComponents.slice(1).join('/') : '';

  return {
    root: storeRoot,
    subPath: storeSubPath + '/' + username,
  };
}

if (!browser.browserAction) {
  browser.browserAction = chrome.browserAction ?? chrome.action;
}
