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

//TODO: Get a host for api
const API_URL = "http://localhost:3000/dubs";
let cachedDubList: ListResponse | null = null;
let currentPage: string | null = null;

// Utility to wait for a DOM element to appear
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

// Format a future date as a countdown string
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

// Create a DOM element with classes and optional text
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

const getAuthToken = async (): Promise<string | null> => {
  try {
    const result = await chrome.storage.local.get("anidub_nonce");
    return result.anidub_nonce ?? null;
  } catch (err) {
    alert(
      "Failed to access localStorage. Please reload the page or extension."
    );
    console.warn("localStorage.getItem failed:", err);
    return null;
  }
};

// ----------------------
// API Calls
// ----------------------
const fetchDubList = async (): Promise<ListResponse | null> => {
  const token = await getAuthToken();
  if (!token) {
    alert("Anidub nonce not found in localStorage. Please log in again.");
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/list`, {
      headers: { Authorization: token },
    });

    if (!res.ok) {
      const err = await res.json();
      console.warn("Failed to fetch dub list:", err.error || res.statusText);
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
  if (!token) {
    alert("Anidub nonce not found in localStorage. Please log in again.");
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      headers: { Authorization: token },
    });

    if (!res.ok) {
      const err = await res.json();
      console.warn("Failed to fetch dub status:", err.error || res.statusText);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn("Error fetching dub status:", err);
    return null;
  }
};

// ----------------------
// Anime Detail Page Handler
// ----------------------
const handleAnimePage = async () => {
  const sidebar = await waitForElement("div.sidebar > div.data");
  sidebar.querySelector(".airing-countdown")?.remove();

  let id = "";
  let statusIndex = -1;

  for (let i = 0; i < 20; i++) {
    id = window.location.pathname.split("/")[2];
    statusIndex = [...sidebar.children].findIndex(
      (child) =>
        child.children.length === 2 &&
        child.children[0].textContent === "Status"
    );
    if (statusIndex !== -1 && id) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!id || statusIndex === -1) {
    console.warn("Anime ID or status row not found.");
    return;
  }

  let dub =
    cachedDubList?.allDubs.find((d) => d.anilistId === parseInt(id)) ??
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

// ----------------------
// Anime List Page Handler
// ----------------------
const handleAnimelistPage = async () => {
  const listContainer = await waitForElement("div.medialist.table div.lists");
  const planningList = [...listContainer.children].find(
    (list) => list.children[0].textContent === "Planning"
  ) as HTMLElement;

  if (!planningList) {
    console.error("Planning list not found.");
    return;
  }

  const headerRow = planningList.children[1].children[0];
  headerRow.insertBefore(
    createElementWithClasses("div", ["dub-status"], "Dub Status"),
    headerRow.children[2]
  );

  cachedDubList = await fetchDubList();
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
  if (!cachedDubList) return;

  const items = list.querySelectorAll("div.entry.row");

  for (const item of items) {
    const title = item.children[1];
    const id = title.children[0]?.getAttribute("href")?.split("/")[2];
    if (!id || item.querySelector(".dub-status")) continue;

    const statusSpan = item.querySelector("div.release-status");
    if (statusSpan?.classList.contains("NOT_YET_RELEASED")) continue;

    const dub = cachedDubList.allDubs.find(
      (d) => d.anilistId === parseInt(id)
    ) ?? {
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

// ----------------------
// Page Change Tracking
// ----------------------
const processPageChange = () => {
  const newPage = window.location.pathname;
  if (newPage === currentPage) return;

  currentPage = newPage;
  console.log("Page changed to:", currentPage);

  if (/user\/.+\/animelist/.test(newPage)) handleAnimelistPage();
  else if (/anime\/.+\/.+/.test(newPage)) handleAnimePage();
};

// Bootstrap: wait for page content, then start observing for changes
(async () => {
  const root = await waitForElement("div.page-content");
  console.log("Anilist page content loaded");

  processPageChange();

  const observer = new MutationObserver(processPageChange);
  observer.observe(root, { childList: true, attributes: true, subtree: true });
})();
