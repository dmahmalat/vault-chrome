/* eslint-disable no-console */
/* eslint-disable no-prototype-builtins */
/* global browser Notify storePathComponents */

const notify = new Notify(document.querySelector('#notify'));
const resultList = document.getElementById('resultList');
const searchInput = document.getElementById('vault-search');
var currentUrl, currentTabId;
var vaultServerAddress, vaultToken, storePath, secretList;

async function mainLoaded() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    const tab = tabs[tabIndex];
    if (tab.url) {
      currentTabId = tab.id;
      currentUrl = tab.url;
      break;
    }
  }

  vaultToken = (await browser.storage.local.get('vaultToken')).vaultToken;
  if (!vaultToken || vaultToken.length === 0) {
    return notify.clear().info(
      `No Vault-Token information available.<br>
      Please use the <a href="/options.html" class="link">options page</a> to login.`,
      { removeOption: false }
    );
  }

  vaultServerAddress = (await browser.storage.sync.get('vaultAddress'))
    .vaultAddress;

  storePath = (await browser.storage.sync.get('storePath')).storePath;
  username = (await browser.storage.sync.get('username')).username;

  secretList = (await browser.storage.sync.get('secrets')).secrets;
  if (!secretList) {
    secretList = [];
  }
  await querySecrets(currentUrl, searchInput.value);
}

async function querySecrets(currentUrl, searchString) {
  var manualSearch = searchString.length !== 0;
  searchString = searchString.toLowerCase();

  resultList.textContent = '';
  const promises = [];
  notify.clear();

  const storeComponents = storePathComponents(storePath, username);
  let matches = 0;

  promises.push(
    (async function () {
      const secretsInPath = await fetch(
        `${vaultServerAddress}/v1/${storeComponents.root}/metadata/${storeComponents.subPath}`,
        {
          method: 'LIST',
          headers: {
            'X-Vault-Token': vaultToken,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!secretsInPath.ok) {
        if (secretsInPath.status !== 404) {
          notify.error(`Unable to read secrets... Try re-login`, {
            removeOption: true,
          });
        }
        return;
      }
      for (const element of (await secretsInPath.json()).data.keys) {
        const urlPattern = new RegExp(element);
        const urlPatternMatch = urlPattern.test(currentUrl);
        let active = false;
        for (const secret of secretList) {
          if (element === secret) {
            active = true;
            break;
          }
        }

        if (urlPatternMatch && active) {
          const urlPath = `${vaultServerAddress}/v1/${storeComponents.root}/data/${storeComponents.subPath}/${element}`;
          const credentials = await getCredentials(urlPath);
          const credentialsSets = extractCredentialsSets(
            credentials.data.data
          );
          for (const item of credentialsSets) {
            const searchPattern = new RegExp(searchString);
            const patternMatches =
              searchPattern.test(item.username.toLowerCase()) ||
              searchPattern.test(item.title.toLowerCase());
            if (!manualSearch || patternMatches) {
              addCredentialsToList(item, element, resultList);
              matches++;
            }
          }
          notify.clear();
        }
      }
    })()
  );

  try {
    await Promise.all(promises);

    if (matches > 0) {
      browser.browserAction.setBadgeText({
        text: `${matches}`,
        tabId: currentTabId,
      });
    } else {
      browser.browserAction.setBadgeText({ text: '', tabId: currentTabId });
      if (!manualSearch) {
        notify.info('No matching key found for this page.', {
          removeOption: false,
        });
      } else {
        notify.info('No matching key found for the search', {
          removeOption: false,
        });
      }
    }
  } catch (err) {
    browser.browserAction.setBadgeText({ text: '', tabId: currentTabId });
    notify.clear().error(err.message);
  }
}

const searchHandler = function (e) {
  if (e.key === 'Enter') {
    mainLoaded();
  }
};

searchInput.addEventListener('keyup', searchHandler);

// Credit:
// https://futurestud.io/tutorials/get-the-part-before-last-occurrence-in-a-string-in-javascript-or-node-js#:~:text=You%20can%20use%20JavaScript's%20String,a%20character%20or%20character%20sequence.
function beforeLast(value, delimiter) {  
  value = value || ''

  if (delimiter === '') {
    return value
  }

  const substrings = value.split(delimiter)

  return substrings.length === 1
    ? value // delimiter is not part of the string
    : substrings.slice(0, -1).join(delimiter)
}

function getPropertyFromKey(key, property) {
  let defaultValue = '';

  if (property.endsWith("_username_enabled")){
    defaultValue = "true";
  }

  return key.hasOwnProperty(property) ? key[property] : defaultValue;
}

function extractCredentialsSets(data) {
  const keys = Object.keys(data);
  const credentials = [];

  for (const key of keys) {
    // Use Username as a key for a given credential object field
    // Skip through other keys (they are part of the same credential object)
    if (key.endsWith("_username")) {
      const fieldName = beforeLast(key, "_username");

      credentials.push({
        title: getPropertyFromKey(data, fieldName + "_title"),
        comment: getPropertyFromKey(data, fieldName + "_comment"),
        username: getPropertyFromKey(data, fieldName + "_username"),
        username_matcher: getPropertyFromKey(data, fieldName + "_username_matcher"),
        username_enabled: getPropertyFromKey(data, fieldName + "_username_enabled"),
        password: getPropertyFromKey(data, fieldName + "_password"),
        password_matcher: getPropertyFromKey(data, fieldName + "_password_matcher"),
        password_enabled: getPropertyFromKey(data, fieldName + "_password_enabled")
      });

    }
  }

  return credentials;
}

function addCredentialsToList(credentials, credentialName, list) {
  const item = document.createElement('li');
  item.classList.add('list__item', 'list__item--three-line');

  const primaryContent = document.createElement('button');
  primaryContent.title = 'insert credentials';
  primaryContent.classList.add(
    'list__item-primary-content',
    'list__item-button',
    'nobutton',
    'js-button',
    'js-ripple-effect'
  );
  primaryContent.addEventListener('click', function () {
    fillCredentialsInBrowser(credentials);
  });
  item.appendChild(primaryContent);

  const titleContent = document.createElement('span');
  titleContent.classList.add('list__item-text-title', 'link');
  titleContent.textContent = credentials.title || credentialName;
  if (credentials.comment && credentials.comment.length > 0) {
    titleContent.title = credentials.comment;
  }
  primaryContent.appendChild(titleContent);

  const detailContent = document.createElement('span');
  detailContent.classList.add('list__item-text-body');
  detailContent.textContent = `ID: ${credentials.username}`;
  primaryContent.appendChild(detailContent);

  const actions = document.createElement('div');
  actions.classList.add('list__item-actions');
  item.appendChild(actions);

  if (credentials.username_enabled === "true") {
    const copyUsernameButton = document.createElement('button');
    copyUsernameButton.classList.add('button');
    copyUsernameButton.title = 'copy username to clipboard';
    copyUsernameButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
        <use href="icons/copy-user.svg#copy-user"/>
      </svg>
    `;
    copyUsernameButton.addEventListener('click', function () {
      copyStringToClipboard(credentials.username);
    });
    actions.appendChild(copyUsernameButton);
  }

  if (credentials.password_enabled === "true") {
    const copyPasswordButton = document.createElement('button');
    copyPasswordButton.classList.add('button');
    copyPasswordButton.title = 'copy password to clipboard';
    copyPasswordButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
        <use href="icons/copy-key.svg#copy-key"/>
      </svg>
    `;
    copyPasswordButton.addEventListener('click', function () {
      copyStringToClipboard(credentials.password);
    });
    actions.appendChild(copyPasswordButton);
  }

  list.appendChild(item);
}

async function getCredentials(urlPath) {
  const vaultToken = (await browser.storage.local.get('vaultToken')).vaultToken;
  const result = await fetch(urlPath, {
    headers: {
      'X-Vault-Token': vaultToken,
      'Content-Type': 'application/json',
    },
  });
  if (!result.ok) {
    throw new Error(`getCredentials: ${await result.text}`);
  }
  return await result.json();
}

async function fillCredentialsInBrowser(credentials) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    const tab = tabs[tabIndex];
    if (tab.url) {
      // tabs.sendMessage(integer tabId, any message, optional object options, optional function responseCallback)

      browser.tabs.sendMessage(tab.id, {
        message: 'fill_creds',
        username: credentials.username,
        username_matcher: credentials.username_matcher,
        password: credentials.password,
        password_matcher: credentials.password_matcher,
        isUserTriggered: true,
      });
      break;
    }
  }
}

async function copyStringToClipboard(string) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    const tab = tabs[tabIndex];
    if (tab.url) {
      browser.tabs.sendMessage(tab.id, {
        message: 'copy_to_clipboard',
        string: string,
      });
      break;
    }
  }
}

document.addEventListener('DOMContentLoaded', mainLoaded, false);
