interface ListResponse {
  allDubs: DubStatus[];
  accessToken: string;
}

interface DubStatus {
  anilistId: number;
  hasDub: boolean;
  isReleasing: boolean;
  dubbedEpisodes: number;
  totalEpisodes: number;
  nextAir: string | null;
}

const API_URL = "http://localhost:3000/list";

// Utilities
const waitForElement = (selector: string): Promise<HTMLElement> =>
  new Promise((resolve) => {
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        resolve(element as HTMLElement);
      }
    }, 100);
  });

const formatDateCountdown = (date: Date): string => {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "Now";

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  return `${days ? `${days}d ` : ""}${hours ? `${hours}h ` : ""}${
    minutes ? `${minutes}m` : ""
  }`.trim();
};

const fetchDubStatus = async (ids: string[]): Promise<ListResponse | null> => {
  const { anilistToken } = await chrome.storage.local.get("anilistToken");
  if (!anilistToken) {
    console.error("Anilist token not found in local storage");
    return null;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: anilistToken,
      },
      body: JSON.stringify({ items: ids }),
    });

    const data: ListResponse = await res.json();
    chrome.storage.local.set({ anilistToken: data.accessToken });
    return data;
  } catch (error) {
    console.error("Failed to fetch dub status:", error);
    return null;
  }
};

const createElementWithClasses = (
  tag: string,
  classList: string[],
  textContent?: string
): HTMLElement => {
  const el = document.createElement(tag);
  el.classList.add(...classList);
  if (textContent) el.textContent = textContent;
  return el;
};

// Anime Detail Page
const handleAnimePage = async () => {
  const id = window.location.pathname.split("/")[2];
  const sidebar = await waitForElement("div.sidebar > div.data");
  const statusIndex = [...sidebar.children].findIndex(
    (child) =>
      child.children.length === 2 && child.children[0].textContent === "Status"
  );

  if (statusIndex === -1) {
    console.error("Sidebar status index not found");
    return;
  }

  const data = await fetchDubStatus([id]);
  if (!data || !data.allDubs.length) return;

  const dub = data.allDubs[0];
  const dataAttr = sidebar.children[statusIndex].attributes[0];
  const wrapper = createElementWithClasses("div", [
    "data-set",
    "airing-countdown",
  ]);
  const label = createElementWithClasses("div", ["type"], "Dub Status");
  const value = createElementWithClasses("div", ["value"]);

  wrapper.setAttribute(dataAttr.name, dataAttr.value);
  label.setAttribute(dataAttr.name, dataAttr.value);
  value.setAttribute(dataAttr.name, dataAttr.value);

  if (!dub.hasDub) value.textContent = "Not available";
  else if (dub.isReleasing && dub.nextAir) {
    const nextAirDate = new Date(dub.nextAir);
    value.textContent = `Ep ${dub.dubbedEpisodes + 1}: ${formatDateCountdown(
      nextAirDate
    )}`;
  } else value.textContent = "Finished";

  wrapper.append(label, value);
  sidebar.insertBefore(wrapper, sidebar.children[statusIndex + 1]);
};

// Anime List Page
const handleAnimelistPage = async () => {
  const listContainer = await waitForElement("div.medialist.table div.lists");
  const planningList = [...listContainer.children].find(
    (list) => list.children[0].textContent === "Planning"
  ) as HTMLElement | undefined;

  if (!planningList) {
    console.error("Planning list not found");
    return;
  }

  const headerRow = planningList.children[1].children[0];
  const headers = headerRow.children;
  const dubHeader = createElementWithClasses(
    "div",
    ["dub-status"],
    "Dub Status"
  );
  headerRow.insertBefore(dubHeader, headers[2]);

  await addDubStatusToAnimeList(planningList);

  let currentLength = planningList.querySelectorAll("div.entry.row").length;
  const observer = new MutationObserver(async () => {
    const newLength = planningList.querySelectorAll("div.entry.row").length;
    if (newLength !== currentLength) {
      currentLength = newLength;
      await addDubStatusToAnimeList(planningList);
    }
  });

  observer.observe(planningList, { childList: true, subtree: true });
};

const addDubStatusToAnimeList = async (list: HTMLElement) => {
  const items = [...list.querySelectorAll("div.entry.row")];
  const ids = items
    .filter((item) => !item.querySelector("div.dub-status"))
    .map(
      (item) =>
        item.children[1]?.children[0]?.getAttribute("href")?.split("/")[2]
    )
    .filter(Boolean) as string[];

  if (!ids.length) return;

  const data = await fetchDubStatus(ids);
  if (!data) return;

  for (const item of items) {
    const title = item.children[1];
    const id = title.children[0]?.getAttribute("href")?.split("/")[2];
    if (!id || item.querySelector("div.dub-status")) continue;

    const dub = data.allDubs.find((d) => d.anilistId === parseInt(id)) ?? {
      anilistId: parseInt(id),
      hasDub: false,
      isReleasing: false,
      dubbedEpisodes: 0,
      totalEpisodes: 0,
      nextAir: null,
    };

    const statusEl = createElementWithClasses("div", ["dub-status"]);
    if (!dub.hasDub) {
      statusEl.textContent = "No Dub";
      statusEl.classList.add("no-dub");
    } else if (dub.isReleasing && dub.nextAir) {
      statusEl.textContent = `Ep ${
        dub.dubbedEpisodes + 1
      }: ${formatDateCountdown(new Date(dub.nextAir))}`;
      statusEl.classList.add("airing");
    } else {
      statusEl.textContent = "Finished";
      statusEl.classList.add("finished");
    }

    title.insertAdjacentElement("afterend", statusEl);
  }
};

// Page Change Watcher
let currentPage: string | null = null;

const processPageChange = () => {
  const newPage = window.location.pathname;
  if (newPage === currentPage) return;

  currentPage = newPage;
  console.log("Page changed to:", currentPage);

  if (/user\/.+\/animelist/.test(newPage)) handleAnimelistPage();
  else if (/anime\/.+\/.+/.test(newPage)) handleAnimePage();
};

// Bootstrapping
(async () => {
  const root = await waitForElement("div.page-content");
  console.log("Anilist page content loaded");

  processPageChange();

  const observer = new MutationObserver(processPageChange);
  observer.observe(root, { childList: true, attributes: true, subtree: true });
})();
