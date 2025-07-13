// Types
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
  Sequels: { sequelId: number }[];
}

// Constants
declare const __ANIDUB_API_URL__: string;
const API_URL = `${__ANIDUB_API_URL__}/dubs`;

let cachedDubList: ListResponse | null = null;
let currentPage: string | null = null;

// ----------------------
// Utility Functions
// ----------------------

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

const createElementWithClasses = (
  tag: string,
  classes: string[],
  text?: string
): HTMLElement => {
  const el = document.createElement(tag);
  el.classList.add(...classes);
  if (text) el.textContent = text;
  return el;
};

const getAuthToken = async (): Promise<string | null> => {
  try {
    const result = await chrome.storage.local.get("anidub_nonce");
    return result.anidub_nonce ?? null;
  } catch (err) {
    alert(
      "Failed to access localStorage. Please reload the page or extension."
    );
    console.warn("Error getting auth token:", err);
    return null;
  }
};

// ----------------------
// API Functions
// ----------------------

const fetchDubList = async (): Promise<ListResponse | null> => {
  const token = await getAuthToken();
  if (!token) {
    alert("Login required. Missing token.");
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/list`, {
      headers: { Authorization: token },
    });
    if (!res.ok) {
      console.warn(
        "Failed to fetch dub list:",
        (await res.json()).error || res.statusText
      );
      return null;
    }

    const data: ListResponse = await res.json();
    chrome.storage.local.set({ anilistToken: data.accessToken });
    return data;
  } catch (err) {
    console.warn("Error fetching dub list:", err);
    return null;
  }
};

const fetchDubStatusById = async (id: string): Promise<DubStatus | null> => {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) {
      console.warn(
        "Failed to fetch dub status:",
        (await res.json()).error || res.statusText
      );
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("Error fetching dub status:", err);
    return null;
  }
};

// ----------------------
// Page Handlers
// ----------------------

const handleAnimePage = async () => {
  const sidebar = await waitForElement("div.sidebar > div.data");
  sidebar.querySelector(".airing-countdown")?.remove();

  const id = window.location.pathname.split("/")[2];
  const statusIndex = [...sidebar.children].findIndex(
    (child) =>
      child.children.length === 2 && child.children[0].textContent === "Status"
  );

  if (!id || statusIndex === -1) return;

  const dub =
    cachedDubList?.allDubs.find((d) => d.anilistId === +id) ||
    (await fetchDubStatusById(id));
  if (!dub) return;

  const dataAttr = sidebar.children[statusIndex].attributes[0];
  const wrapper = createElementWithClasses("div", [
    "data-set",
    "airing-countdown",
  ]);
  const label = createElementWithClasses("div", ["type"], "Dub Status");
  const value = createElementWithClasses("div", ["value"]);

  [wrapper, label, value].forEach((el) =>
    el.setAttribute(dataAttr.name, dataAttr.value)
  );

  if (!dub.hasDub) value.textContent = "Not available";
  else if (dub.isReleasing && dub.nextAir) {
    value.textContent = `Ep ${dub.dubbedEpisodes + 1}: ${formatDateCountdown(
      new Date(dub.nextAir)
    )}`;
  } else {
    value.textContent = "Finished";
  }

  wrapper.append(label, value);
  sidebar.insertBefore(wrapper, sidebar.children[statusIndex + 1]);
};

const handleAnimelistPage = async () => {
  const listContainer = await waitForElement("div.medialist.table div.lists");

  const findListByTitle = (title: string) =>
    [...listContainer.children].find(
      (list) => list.children[0].textContent === title
    ) as HTMLElement;

  const planningList = findListByTitle("Planning");
  const completedList = findListByTitle("Completed");

  cachedDubList = await fetchDubList();
  if (!cachedDubList) return;

  if (planningList) {
    insertHeader(planningList, "dub-status", "Dub Status");
    await addDubStatusToAnimeList(planningList);
    observeListChanges(planningList, addDubStatusToAnimeList);
  }

  if (completedList) {
    insertHeader(completedList, "sequel-status", "Sequel Status");
    await addSequelStatusToCompletedList(completedList);
    observeListChanges(completedList, addSequelStatusToCompletedList);
  }
};

const insertHeader = (list: HTMLElement, className: string, label: string) => {
  const headerRow = list.children[1].children[0];
  const header = createElementWithClasses("div", [className], label);
  headerRow.insertBefore(header, headerRow.children[2]);
};

const observeListChanges = (
  list: HTMLElement,
  callback: (list: HTMLElement) => Promise<void>
) => {
  let currentLength = list.querySelectorAll("div.entry.row").length;
  const observer = new MutationObserver(async () => {
    const newLength = list.querySelectorAll("div.entry.row").length;
    if (newLength !== currentLength) {
      currentLength = newLength;
      await callback(list);
    }
  });
  observer.observe(list, { childList: true, subtree: true });
};

// ----------------------
// Content Modifiers
// ----------------------

const addDubStatusToAnimeList = async (list: HTMLElement) => {
  const items = list.querySelectorAll("div.entry.row");
  for (const item of items) {
    const title = item.children[1];
    const id = title.children[0]?.getAttribute("href")?.split("/")[2];
    if (!id || item.querySelector(".dub-status")) continue;

    const statusSpan = item.querySelector("div.release-status");
    if (statusSpan?.classList.contains("NOT_YET_RELEASED")) continue;

    const dub = cachedDubList!.allDubs.find((d) => d.anilistId === +id) ?? {
      anilistId: +id,
      hasDub: false,
      isReleasing: false,
      dubbedEpisodes: 0,
      totalEpisodes: 0,
      nextAir: null,
      Sequels: [],
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

const addSequelStatusToCompletedList = async (list: HTMLElement) => {
  const items = list.querySelectorAll("div.entry.row");
  const completedIds = new Set<string>();
  const planningIds = new Set<string>();

  for (const item of items) {
    const id = item.children[1].children[0]
      ?.getAttribute("href")
      ?.split("/")[2];
    if (id) completedIds.add(id);
  }

  // Build planningIds from ListResponse using the planning list found in the DOM
  const listContainer = list.parentElement;
  let planningList: HTMLElement | undefined;
  if (listContainer) {
    planningList = [...listContainer.children].find(
      (l) => l.children[0]?.textContent === "Planning"
    ) as HTMLElement;
  }
  if (planningList && cachedDubList?.allDubs) {
    const planningItems = planningList.querySelectorAll("div.entry.row");
    for (const item of planningItems) {
      const id = item.children[1].children[0]
        ?.getAttribute("href")
        ?.split("/")[2];
      if (
        id &&
        cachedDubList.allDubs.find((d) => d.anilistId.toString() === id)
      ) {
        planningIds.add(id);
      }
    }
  }

  for (const item of items) {
    const title = item.children[1];
    const id = title.children[0]?.getAttribute("href")?.split("/")[2];
    if (!id || item.querySelector(".sequel-status")) continue;

    const dub = cachedDubList!.allDubs.find((d) => d.anilistId === +id);
    const statusEl = createElementWithClasses("div", ["sequel-status"]);

    if (dub?.Sequels?.length) {
      const missingSequels = dub.Sequels.filter(
        (seq) =>
          !completedIds.has(seq.sequelId.toString()) &&
          !planningIds.has(seq.sequelId.toString())
      );
      if (missingSequels.length > 0) {
        statusEl.textContent = "Sequel Available";
        statusEl.classList.add("sequel-available");
      }
    }

    title.insertAdjacentElement("afterend", statusEl);
  }
};

// ----------------------
// Page Routing
// ----------------------

const processPageChange = () => {
  const newPage = window.location.pathname;
  if (newPage === currentPage) return;
  currentPage = newPage;

  if (/user\/.+\/animelist/.test(newPage)) handleAnimelistPage();
  else if (/anime\/.+\/.+/.test(newPage)) handleAnimePage();
};

// ----------------------
// Init
// ----------------------

(async () => {
  const root = await waitForElement("div.page-content");
  console.log("Anilist page content loaded");

  processPageChange();

  const observer = new MutationObserver(processPageChange);
  observer.observe(root, { childList: true, attributes: true, subtree: true });
})();
