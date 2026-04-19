import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const STORAGE_KEYS = {
  posts: "profile-book-image-posts",
  logs: "profile-book-admin-logs"
};

const firebaseConfig = {
  apiKey: "AIzaSyA23BvxDUz1Zs3gLx14ryJceBRgplw5M2g",
  authDomain: "purohutyoukannriapuri.firebaseapp.com",
  projectId: "purohutyoukannriapuri",
  appId: "1:744118297042:web:b75284f666aeff9f26e80b"
};

const cloudinaryConfig = {
  cloudName: "difcajxz5",
  uploadPreset: "prohutyou",
  folder: "profile-book"
};

const spreadsheetConfig = {
  endpointUrl: "https://script.google.com/macros/s/AKfycbwV6XbOMgSyiD_8OzsDo_XErVdkihVw6al5z_W77Zj8x8tk_T5hcwDtVsDqpK7L2JQm/exec"
};

const adminEmails = ["admin@example.com"];

const seedPosts = [
  {
    id: "PB-001",
    memo: "春のサンプル",
    frontImageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
    backImageUrl:
      "https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=900&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "PB-002",
    memo: "夏のサンプル",
    frontImageUrl:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
    backImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const state = {
  posts: load(STORAGE_KEYS.posts, seedPosts),
  logs: load(STORAGE_KEYS.logs, []),
  selectedTag: "",
  searchTerm: "",
  editingPostId: null,
  currentUser: null,
  auth: null,
  sheetMetaById: {},
  sheetReady: false
};

const elements = {
  searchInput: document.querySelector("#searchInput"),
  tagFilters: document.querySelector("#tagFilters"),
  postList: document.querySelector("#postList"),
  seedButton: document.querySelector("#seedButton"),
  refreshSheetButton: document.querySelector("#refreshSheetButton"),
  sheetStatus: document.querySelector("#sheetStatus"),
  authStatus: document.querySelector("#authStatus"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  postForm: document.querySelector("#postForm"),
  postIdInput: document.querySelector("#postIdInput"),
  memoInput: document.querySelector("#memoInput"),
  frontImageInput: document.querySelector("#frontImageInput"),
  backImageInput: document.querySelector("#backImageInput"),
  adminPostList: document.querySelector("#adminPostList"),
  logList: document.querySelector("#logList"),
  editingState: document.querySelector("#editingState"),
  postCardTemplate: document.querySelector("#postCardTemplate")
};

boot();

async function boot() {
  persistAll();
  bindEvents();
  resetForm();
  initFirebase();
  await refreshSheetMeta();
  renderAll();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderPublicPosts();
  });

  elements.seedButton.addEventListener("click", async () => {
    state.posts = structuredClone(seedPosts);
    savePosts();
    pushLog("seed", "サンプル投稿を再投入しました");
    await refreshSheetMeta();
    renderAll();
  });

  elements.refreshSheetButton.addEventListener("click", async () => {
    await refreshSheetMeta();
    renderAll();
  });

  elements.loginButton.addEventListener("click", async () => {
    if (!state.auth) {
      showAuthStatus("Firebase設定を入力するとGoogleログインを有効化できます。");
      return;
    }

    try {
      await signInWithPopup(state.auth, new GoogleAuthProvider());
    } catch (error) {
      showAuthStatus(`ログインに失敗しました: ${error.message}`);
    }
  });

  elements.logoutButton.addEventListener("click", async () => {
    if (state.auth) {
      await signOut(state.auth);
    }
  });

  elements.postForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAdmin()) {
      showAuthStatus("管理ユーザとしてログインすると投稿できます。");
      return;
    }

    if (!cloudinaryReady()) {
      showAuthStatus("Cloudinary の `cloudinaryConfig` を入力してください。");
      return;
    }

    const existing = state.posts.find((post) => post.id === state.editingPostId);
    const frontFile = elements.frontImageInput.files[0];
    const backFile = elements.backImageInput.files[0];

    if (!existing && (!frontFile || !backFile)) {
      showAuthStatus("新規投稿では表画像と裏画像の両方が必要です。");
      return;
    }

    showAuthStatus("Cloudinary に画像をアップロードしています。");

    try {
      const frontImageUrl = frontFile
        ? await uploadToCloudinary(frontFile, `${elements.postIdInput.value}-front`)
        : existing.frontImageUrl;
      const backImageUrl = backFile
        ? await uploadToCloudinary(backFile, `${elements.postIdInput.value}-back`)
        : existing.backImageUrl;

      const now = new Date().toISOString();
      const post = {
        id: elements.postIdInput.value,
        memo: elements.memoInput.value.trim(),
        frontImageUrl,
        backImageUrl,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      if (existing) {
        state.posts = state.posts.map((entry) => (entry.id === post.id ? post : entry));
        pushLog("update", `投稿を更新しました: ${post.id}`);
      } else {
        state.posts = [post, ...state.posts];
        pushLog("create", `投稿を作成しました: ${post.id}`);
      }

      savePosts();
      resetForm();
      renderAll();
      showAuthStatus(`保存しました: ${post.id}`, true);
    } catch (error) {
      showAuthStatus(`投稿保存に失敗しました: ${error.message}`);
    }
  });
}

function initFirebase() {
  if (!firebaseReady()) {
    showAuthStatus("Firebase 未設定です。`app.js` の firebaseConfig と adminEmails を更新してください。");
    renderAdminState();
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    state.auth = getAuth(app);
    showAuthStatus("Firebase 接続済みです。管理者アカウントでログインしてください。");

    onAuthStateChanged(state.auth, async (user) => {
      if (user && adminEmails.includes(user.email)) {
        state.currentUser = user;
        showAuthStatus(`管理ユーザでログイン中: ${user.email}`, true);
      } else if (user) {
        state.currentUser = null;
        showAuthStatus(`このアカウントは管理者ではありません: ${user.email}`);
        await signOut(state.auth);
      } else {
        state.currentUser = null;
        showAuthStatus("管理機能を使うには Google ログインしてください。");
      }

      renderAdminState();
    });
  } catch (error) {
    showAuthStatus(`Firebase 初期化に失敗しました: ${error.message}`);
  }
}

async function refreshSheetMeta() {
  if (!spreadsheetReady()) {
    state.sheetMetaById = {};
    state.sheetReady = false;
    showSheetStatus("Spreadsheet 未設定です。`spreadsheetConfig.endpointUrl` を入力してください。");
    return;
  }

  showSheetStatus("Spreadsheet からタグとリアクションを取得しています。");

  try {
    const url = new URL(spreadsheetConfig.endpointUrl);
    url.searchParams.set("mode", "posts");
    url.searchParams.set("_", String(Date.now()));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.posts ?? [];
    state.sheetMetaById = rows.reduce((accumulator, row) => {
      const normalized = normalizeSheetRow(row);
      if (normalized.postId) {
        accumulator[normalized.postId] = normalized;
      }
      return accumulator;
    }, {});
    state.sheetReady = true;
    showSheetStatus("Spreadsheet との同期が完了しました。", true);
  } catch (error) {
    state.sheetReady = false;
    showSheetStatus(`Spreadsheet の取得に失敗しました: ${error.message}`);
  }
}

function renderAll() {
  renderTagFilters();
  renderPublicPosts();
  renderAdminPosts();
  renderLogs();
  renderAdminState();
}

function renderTagFilters() {
  const tags = [
    ...new Set(
      state.posts.flatMap((post) => {
        const meta = getSheetMeta(post.id);
        return meta.tags;
      })
    )
  ].sort((a, b) => a.localeCompare(b, "ja"));

  elements.tagFilters.innerHTML = "";
  elements.tagFilters.appendChild(createTagButton("すべて", ""));

  tags.forEach((tag) => {
    elements.tagFilters.appendChild(createTagButton(`#${tag}`, tag));
  });
}

function createTagButton(label, value) {
  const button = document.createElement("button");
  button.className = `tag-button${state.selectedTag === value ? " is-active" : ""}`;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    state.selectedTag = value;
    renderTagFilters();
    renderPublicPosts();
  });
  return button;
}

function renderPublicPosts() {
  const filteredPosts = state.posts.filter((post) => {
    const meta = getSheetMeta(post.id);
    const haystack = `${post.id} ${meta.tags.join(" ")}`.toLowerCase();
    const matchesKeyword = !state.searchTerm || haystack.includes(state.searchTerm);
    const matchesTag = !state.selectedTag || meta.tags.includes(state.selectedTag);
    return matchesKeyword && matchesTag;
  });

  elements.postList.innerHTML = "";

  if (filteredPosts.length === 0) {
    elements.postList.innerHTML = `<div class="empty-state">該当するプロフィール帳がありません。</div>`;
    return;
  }

  filteredPosts.forEach((post) => {
    const meta = getSheetMeta(post.id);
    const fragment = elements.postCardTemplate.content.cloneNode(true);
    const id = fragment.querySelector(".post-id");
    const date = fragment.querySelector(".post-date");
    const frontImage = fragment.querySelector(".post-image-front");
    const backImage = fragment.querySelector(".post-image-back");
    const tags = fragment.querySelector(".post-tags");
    const buttons = fragment.querySelectorAll(".reaction-button");

    id.textContent = post.id;
    date.textContent = `更新: ${formatDate(post.updatedAt)}`;
    frontImage.src = post.frontImageUrl;
    frontImage.alt = `${post.id} の表画像`;
    backImage.src = post.backImageUrl;
    backImage.alt = `${post.id} の裏画像`;
    tags.innerHTML = meta.tags.length
      ? meta.tags.map((tag) => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join("")
      : `<span class="tag-chip">#未分類</span>`;

    buttons.forEach((button) => {
      const reactionType = button.dataset.reaction;
      const count = meta.reactions[reactionType] ?? 0;
      button.querySelector(".reaction-count").textContent = String(count);
      button.addEventListener("click", async () => {
        await handleReaction(post.id, reactionType);
      });
    });

    elements.postList.appendChild(fragment);
  });
}

function renderAdminPosts() {
  elements.adminPostList.innerHTML = "";

  if (state.posts.length === 0) {
    elements.adminPostList.innerHTML = `<div class="empty-state">まだ投稿がありません。</div>`;
    return;
  }

  state.posts.forEach((post) => {
    const meta = getSheetMeta(post.id);
    const wrapper = document.createElement("article");
    wrapper.className = "admin-post-item";
    wrapper.innerHTML = `
      <div class="admin-post-item-header">
        <div>
          <strong>${escapeHtml(post.id)}</strong>
          <div class="log-meta">${escapeHtml(post.memo || "メモなし")}</div>
        </div>
        <div class="log-meta">${formatDate(post.updatedAt)}</div>
      </div>
      <div class="tag-list">${meta.tags.map((tag) => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join("") || '<span class="tag-chip">#未分類</span>'}</div>
      <div class="admin-post-actions">
        <button class="admin-action" type="button" data-action="edit">編集</button>
        <button class="admin-action danger" type="button" data-action="delete">削除</button>
      </div>
    `;

    wrapper.querySelector('[data-action="edit"]').addEventListener("click", () => {
      populateForm(post);
    });

    wrapper.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (!isAdmin()) {
        showAuthStatus("管理ユーザのみ削除できます。");
        return;
      }

      state.posts = state.posts.filter((entry) => entry.id !== post.id);
      pushLog("delete", `投稿を削除しました: ${post.id}`);
      savePosts();

      if (state.editingPostId === post.id) {
        resetForm();
      }

      renderAll();
    });

    elements.adminPostList.appendChild(wrapper);
  });
}

function renderLogs() {
  elements.logList.innerHTML = "";

  if (state.logs.length === 0) {
    elements.logList.innerHTML = `<div class="empty-state">まだログはありません。</div>`;
    return;
  }

  state.logs.forEach((log) => {
    const item = document.createElement("article");
    item.className = "log-item";
    item.innerHTML = `
      <strong>${escapeHtml(log.type.toUpperCase())}</strong>
      <div>${escapeHtml(log.text)}</div>
      <div class="log-meta">${formatDate(log.createdAt)}</div>
    `;
    elements.logList.appendChild(item);
  });
}

function renderAdminState() {
  const unlocked = isAdmin();
  elements.postForm.classList.toggle("locked", !unlocked);
  elements.loginButton.classList.toggle("hidden", unlocked);
  elements.logoutButton.classList.toggle("hidden", !unlocked);
  elements.editingState.textContent = state.editingPostId ? "編集モード" : "新規投稿モード";
}

function populateForm(post) {
  if (!isAdmin()) {
    showAuthStatus("管理ユーザとしてログインすると編集できます。");
    return;
  }

  state.editingPostId = post.id;
  elements.postIdInput.value = post.id;
  elements.memoInput.value = post.memo ?? "";
  elements.frontImageInput.value = "";
  elements.backImageInput.value = "";
  renderAdminState();
}

function resetForm() {
  state.editingPostId = null;
  elements.postForm.reset();
  elements.postIdInput.value = buildPostId();
  renderAdminState();
}

async function handleReaction(postId, reactionType) {
  if (!spreadsheetReady()) {
    showSheetStatus("Spreadsheet 連携が未設定のためリアクションできません。");
    return;
  }

  try {
    const response = await fetch(spreadsheetConfig.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        mode: "reaction",
        postId,
        reactionType
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const meta = normalizeSheetRow(payload.post ?? payload);
    if (meta.postId) {
      state.sheetMetaById[meta.postId] = meta;
    }
    showSheetStatus(`${postId} にリアクションしました。`, true);
    renderTagFilters();
    renderPublicPosts();
  } catch (error) {
    showSheetStatus(`リアクション送信に失敗しました: ${error.message}`);
  }
}

async function uploadToCloudinary(file, publicId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);
  formData.append("folder", cloudinaryConfig.folder);
  formData.append("public_id", publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload.secure_url;
}

function normalizeSheetRow(row) {
  const tags = Array.isArray(row.tags)
    ? row.tags
    : String(row.tags ?? "")
        .split(/[,\n]/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean);

  return {
    postId: String(row.postId ?? row.id ?? "").trim(),
    tags,
    reactions: {
      like: Number(row.like ?? row.reactions?.like ?? 0),
      cute: Number(row.cute ?? row.reactions?.cute ?? 0),
      want: Number(row.want ?? row.reactions?.want ?? 0)
    }
  };
}

function getSheetMeta(postId) {
  return (
    state.sheetMetaById[postId] ?? {
      postId,
      tags: [],
      reactions: {
        like: 0,
        cute: 0,
        want: 0
      }
    }
  );
}

function pushLog(type, text) {
  state.logs.unshift({
    id: crypto.randomUUID(),
    type,
    text,
    createdAt: new Date().toISOString()
  });
  saveLogs();
}

function showAuthStatus(text, success = false) {
  elements.authStatus.textContent = text;
  elements.authStatus.classList.toggle("is-ready", success);
}

function showSheetStatus(text, success = false) {
  elements.sheetStatus.textContent = text;
  elements.sheetStatus.classList.toggle("is-ready", success);
}

function buildPostId() {
  return `PB-${String(Date.now()).slice(-6)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function load(key, fallback) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

function persistAll() {
  savePosts();
  saveLogs();
}

function savePosts() {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(state.posts));
}

function saveLogs() {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
}

function isAdmin() {
  return Boolean(state.currentUser?.email && adminEmails.includes(state.currentUser.email));
}

function firebaseReady() {
  return Object.values(firebaseConfig).every((value) => value && !String(value).startsWith("YOUR_"));
}

function cloudinaryReady() {
  return Object.values(cloudinaryConfig).every((value) => value && !String(value).startsWith("YOUR_"));
}

function spreadsheetReady() {
  return Boolean(
    spreadsheetConfig.endpointUrl &&
      !String(spreadsheetConfig.endpointUrl).startsWith("YOUR_")
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
