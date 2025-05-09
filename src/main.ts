const rootElement = document.querySelector('div.page-content');

let sidebarInfoAdded = false;

type StatusString = 'finished' | 'no dub' | 'releasing' | 'error' | 'not found';

interface Status {
  status: string;
  nextAir: Date | null;
  episodes: number | null;
  totalEpisodes: number | null;
}

if (/user\/.+\//.test(window.location.pathname)) {
  addNavbarListener();

  if (/user\/.+\/animelist/.test(window.location.pathname)) {
    // addDubStatuses();
    addRandomizer();
  }
}

if (/anime\/\d+\/.+/.test(window.location.pathname)) addSidebarListener();

const pageObserver = new MutationObserver((mutationsList) => {
  if (/user\/.+\//.test(window.location.pathname)) addNavbarListener();
  if (/anime\/\d+\/.+/.test(window.location.pathname)) addSidebarListener();
});

if (!rootElement) throw new Error('Could not find root element!');

pageObserver.observe(rootElement, {
  childList: true,
});

function addRandomizer() {
  const section = [...document.querySelectorAll('h3.section-name')].find(
    (x) => x.textContent === 'Planning'
  );

  if (!section) {
    console.log('Could not find planning section!');
    setTimeout(addRandomizer, 1000);
    return;
  }

  const itemList =
    section.nextElementSibling?.querySelector('div.list-entries');

  if (!itemList) {
    console.log('Could not find list entries!');
    setTimeout(addRandomizer, 1000);
    return;
  }

  const randomButtonContainer = document.createElement('div');

  randomButtonContainer.classList.add('random-button-container');

  const randomButton = document.createElement('button');

  randomButtonContainer.appendChild(randomButton);

  randomButton.classList.add('random-button');

  randomButton.style.background = `url("${chrome.runtime.getURL(
    'src/public/shuffle.svg'
  )}")`;

  document.body.appendChild(randomButtonContainer);

  randomButton.onclick = () => {
    selectRandomItem(itemList);
  };
}

function selectRandomItem(itemList: Element) {
  const items = itemList.querySelectorAll('div.entry.row');

  const randomItem = items[Math.floor(Math.random() * items.length)];

  if (randomItem.children[2].textContent !== '✅')
    return selectRandomItem(itemList);

  randomItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

  randomItem.classList.add('random-entry');

  setTimeout(() => {
    randomItem.classList.remove('random-entry');
  }, 1250);
}

function addNavbarListener() {
  const navbar = document.querySelector('div.nav.container');

  if (!navbar) throw new Error('Could not find navbar!');

  const navbarObserver = new MutationObserver((mutationsList) => {
    const activeSection = navbar.querySelector('a.router-link-active');

    if (!activeSection) throw new Error('Could not find active section!');

    if (activeSection.textContent?.trim() !== 'Anime List') return;

    addDubStatuses();
  });

  navbarObserver.observe(navbar, {
    attributes: true,
    subtree: true,
  });
}

/**
 * Adds dub statuses to the anime list page.
 */
async function addDubStatuses() {
  console.log('Adding dub statuses...');
  const sections = document.querySelectorAll('div.list-section');

  // wait for div.lists to load
  if (sections.length === 0) {
    console.log('Waiting for lists to load...');
    setTimeout(addDubStatuses, 1000);
    return;
  }

  for (const section of sections) {
    addSectionHeader(section);

    const items = section.querySelectorAll('div.entry.row');

    for (const item of items) addItemStatus(item);

    addSectionObserver(section);
  }
}

/**
 * Adds a MutationObserver to a section element to detect
 * when new items are added to the list.
 */
function addSectionObserver(section: Element) {
  const entriesNode = section.querySelector('div.list-entries');

  if (!entriesNode) {
    console.error('Could not find entries node for section:', section);

    return;
  }

  const sectionObserver = new MutationObserver(async (mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const newItems = Array.from(mutation.addedNodes).filter(
          (node) => node instanceof Element
        );

        for (const item of newItems) addItemStatus(item);
      }
    }
  });

  sectionObserver.observe(entriesNode, {
    childList: true,
  });
}

/**
 * Adds a 'Dubbed' section header to the given section element.
 */
function addSectionHeader(section: Element) {
  const header = section.querySelector('div.list-head.row');

  if (!header) {
    console.error('Could not find header for section:', section);

    return;
  }

  const dubbed = document.createElement('div');

  dubbed.classList.add('dubbed');

  dubbed.textContent = 'Dubbed';

  header.insertBefore(dubbed, header.children[2]);
}

/**
 * Adds a '✅' status to the given item element.
 */
async function addItemStatus(item: Element) {
  const titleNode = item.children[1];
  const titleLink = titleNode.children[0];

  if (item.children[2].classList.contains('dubbed')) return;

  const id = titleLink.getAttribute('href')?.match(/\/anime\/(\d+)\//)?.[1];

  const container = document.createElement('div');

  container.classList.add('dubbed');

  const response = await fetch(
    `https://anidub.diskstation.local/check?name=${titleLink.textContent}&id=${id}`
  );

  const status: Status = await response.json();

  switch (status.status) {
    case 'finished':
      container.textContent = '✅';
      container.title = `Finished airing with ${status.totalEpisodes} episodes.`;
      break;
    case 'no dub':
      container.textContent = '❌';
      container.title = 'No dub available.';
      break;
    case 'releasing':
      container.textContent = `${status.episodes}/${status.totalEpisodes}`;
      container.title = `Currently airing. Next episode airs on ${status.nextAir}.`;
      break;
    case 'error':
      container.textContent = '❓';
      container.title = 'Error checking dub status.';
      break;
    case 'not found':
      container.textContent = '❔';
      container.title = 'Anime not found.';
      break;
    default:
      container.textContent = '❔';
      container.title = 'Unknown status.';
  }

  item.insertBefore(container, item.children[2]);
}

function addSidebarListener() {
  console.log('Adding sidebar listener...');

  sidebarInfoAdded = false;

  const contentNode = document.querySelector('div.page-content');

  if (!contentNode) throw new Error('Could not find content node!');

  const sidebarObserver = new MutationObserver((mutationsList) => {
    if (!/anime\/\d+\/.+/.test(window.location.pathname)) return;

    const sidebar = document.querySelector('div.sidebar');

    if (!sidebar || sidebarInfoAdded) {
      console.log('Sidebar not found or info already added!', sidebarInfoAdded);
      return;
    }

    addDubStatus();
  });

  sidebarObserver.observe(contentNode, {
    childList: true,
    subtree: true,
  });
}

async function addDubStatus() {
  if (sidebarInfoAdded) {
    console.log('Sidebar info already added!');
    return;
  }

  console.log('Adding dub status to sidebar...');

  const sidebarItems = document.querySelectorAll(
    'div.sidebar div.data div.data-set'
  );

  const statusItem = [...sidebarItems].find(
    (item) => item.querySelector('.type')?.textContent === 'Status'
  );

  if (!statusItem) {
    console.log('Could not find status item!');
    return;
  }

  sidebarInfoAdded = true;

  const statusContainer = document.createElement('div');
  statusContainer.classList.add('data-set', 'dub-status');

  const statusHeader = document.createElement('div');
  statusHeader.classList.add('type');
  statusHeader.textContent = 'Dub Status';

  const header = document.querySelector('div.header');

  const title = header?.children[0].children[1].children[0].textContent?.trim();

  console.log('Searching for anime:', title);

  const id = window.location.pathname.match(/\/anime\/(\d+)\//)?.[1];

  const response = await fetch(
    `https://anidub.diskstation.local/check?name=${title}&id=${id}`
  );

  const status: Status = await response.json();

  const statusValue = document.createElement('div');
  statusValue.classList.add('value');

  switch (status.status) {
    case 'finished':
      statusValue.textContent = 'Finished';
      break;
    case 'no dub':
      statusValue.textContent = 'No Dub';
      break;
    case 'releasing':
      if (status.nextAir) {
        const nextAir = new Date(status.nextAir);

        const timeUntil = nextAir.getTime() - Date.now();

        const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );

        const minutes = Math.floor(
          (timeUntil % (1000 * 60 * 60)) / (1000 * 60)
        );

        let str = '';

        if (days > 0) str += `${days}d `;
        if (hours > 0) str += `${hours}h `;
        if (minutes > 0) str += `${minutes}m`;

        statusValue.textContent = `Ep ${status.episodes! + 1}: ${str}`;
        statusContainer.classList.add('releasing');
      } else
        statusValue.textContent = `${status.episodes}/${status.totalEpisodes}`;
      break;
    case 'error':
      statusValue.textContent = 'Error';
      break;
    case 'not found':
      statusValue.textContent = 'Not Found';
      break;
    default:
      statusValue.textContent = 'Unknown';
  }

  statusContainer.appendChild(statusHeader);
  statusContainer.appendChild(statusValue);

  statusItem.after(statusContainer);
}
