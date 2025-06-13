// 🔌 استيراد Firebase وخدمات Firestore و Auth
import { db, auth } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const lucide = window.lucide || {
  createIcons: () => {
    console.warn("Lucide library not loaded yet");
  },
};
//  المراجع لعناصر الصفحة
const communityNameEl = document.getElementById("communityName");
const communityDescEl = document.getElementById("communityDescription");
const ideaContainerEl = document.getElementById("ideaContainer");
let communityId;
document.addEventListener("DOMContentLoaded", initPage);

function initPage() {
  //  جلب معرف المجتمع من الرابط
  const urlParams = new URLSearchParams(window.location.search);
  communityId = urlParams.get("id");
// إذا ما في id، بنعرض خطأ
  if (!communityId) {
    showErrorPage("Community ID not found", "Please select a community from the list", [
      { text: "Go to Communities", url: "communities.html" },
    ]);
    return;
  }

  setupAuthStateListener();
  addCustomStyles();
}

function addCustomStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .idea-attachments {
      margin: 1rem 0;
      border-top: 1px solid #eee;
      padding-top: 1rem;
    }
    
    .attachment-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 0.5rem;
      background-color: #f8f9fa;
      margin-bottom: 0.5rem;
      transition: all 0.2s ease;
    }
    
    .attachment-item:hover {
      background-color: #e9ecef;
    }
    
    .attachment-icon {
      width: 24px;
      height: 24px;
      color: #6c757d;
    }
    
    .attachment-link {
      color: #0d6efd;
      text-decoration: none;
      font-weight: 500;
      flex: 1;
    }
    
    .attachment-link:hover {
      text-decoration: underline;
    }
    
    .attachment-info {
      display: flex;
      flex-direction: column;
    }
    
    .attachment-info small {
      color: #6c757d;
      font-size: 0.8rem;
    }
    .idea-card {
      position: relative;
      overflow: hidden;
    }
    
    .idea-image {
      max-height: 300px;
      object-fit: contain;
    }
  `;
  document.head.appendChild(style);
}

function setupAuthStateListener() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showErrorPage("Login Required", "Please log in to view this community", [
        { text: "Go to Login", url: "login.html" },
        { text: "Back to Home", url: "index.html" },
      ]);
      return;
    }

    try {
      const isMember = await checkMembership(user.uid);
      if (isMember) {
        await Promise.all([loadCommunityDetails(), loadCommunityIdeas()]);
      }
    } catch (error) {
      console.error("Initialization error:", error);
      showErrorPage("Initialization Failed", "Could not load community data", [
        { text: "Try Again", action: () => window.location.reload() },
        { text: "Go to Communities", url: "communities.html" },
      ]);
    }
  });
}

async function checkMembership(userId) {
  try {
    showLoadingState("Verifying your membership...");
    const memberRef = doc(db, "communities", communityId, "members", userId);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists() || !memberSnap.data().isApproved) {
      showToast("You need to join this community first", "error");
      setTimeout(() => {
        window.location.href = `community-details.html?id=${communityId}`;
      }, 2000);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Membership check error:", error);
    throw new Error("Failed to verify membership status");
  }
}

async function loadCommunityDetails() {
  try {
    const communityRef = doc(db, "communities", communityId);
    const communitySnap = await getDoc(communityRef);

    if (!communitySnap.exists()) throw new Error("Community not found");

    const data = communitySnap.data();
    communityNameEl.textContent = data.name;
    communityDescEl.textContent = data.description || "No description available.";
    setupCreatorFeatures(data.createdBy);
  } catch (error) {
    console.error("Failed to load community:", error);
    throw new Error("Could not load community details");
  }
}

function setupCreatorFeatures(creatorId) {
  onAuthStateChanged(auth, (user) => {
    if (user && user.uid === creatorId) {
      const requestLink = document.createElement("a");
      requestLink.href = `requests.html?communityId=${communityId}`;
      requestLink.innerHTML = `<i data-lucide="inbox"></i> Requests`;
      requestLink.className = "nav-link";

      const navbar = document.querySelector(".navbar .nav-links");
      if (navbar) {
        const li = document.createElement("li");
        li.appendChild(requestLink);
        navbar.insertBefore(li, navbar.children[1]);
        if (window.lucide) lucide.createIcons();
      }
    }
  });
}

async function getCommentsCount(ideaId) {
  try {
    const commentsRef = collection(db, "communities", communityId, "ideas", ideaId, "comments");
    const snapshot = await getDocs(commentsRef);
    return snapshot.size;
  } catch (error) {
    console.error("Error getting comments count:", error);
    return 0;
  }
}
// تحميل الأفكار المرتبطة بالمجتمع وترتيبهم حسب الوقت
async function loadCommunityIdeas() {
  try {
    showLoadingState("Loading community ideas...");

    const ideasRef = collection(db, "communities", communityId, "ideas");
    const q = query(ideasRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      showEmptyState();
      return;
    }

    await renderIdeas(querySnapshot);
  } catch (error) {
    console.error("Error loading ideas:", error);
    throw new Error("Failed to load community ideas");
  }
}

async function renderIdeas(querySnapshot) {
  ideaContainerEl.innerHTML = "";

  const ideasData = [];
  const userFetchPromises = [];
  const commentsCountPromises = [];

  querySnapshot.forEach((docSnap) => {
    const idea = docSnap.data();
    ideasData.push({ idea, id: docSnap.id });

    // Add fallback to current user if fetch fails
    userFetchPromises.push(
      idea.userId 
        ? getUserInfo(idea.userId).catch(() => getDefaultUserInfo())
        : Promise.resolve(getUserDisplayInfo(auth.currentUser))
    );
    
    commentsCountPromises.push(getCommentsCount(docSnap.id));
  });

  try {
    const [usersData, commentsCounts] = await Promise.all([
      Promise.all(userFetchPromises),
      Promise.all(commentsCountPromises),
    ]);

    ideasData.forEach(({ idea, id }, index) => {
      idea.commentsCount = commentsCounts[index];
      createIdeaCard(idea, id, usersData[index], index * 100);
    });
  } catch (error) {
    console.error("Error rendering ideas:", error);
    showErrorPage(
      "Loading Error",
      "Could not load all idea data. Showing available content.",
      [
        { text: "Try Again", action: () => window.location.reload() },
        { text: "Go to Communities", url: "communities.html" }
      ]
    );
    
    // Render what we can
    ideasData.forEach(({ idea, id }, index) => {
      idea.commentsCount = 0;
      createIdeaCard(idea, id, getDefaultUserInfo(), index * 100);
    });
  }
}
      // محتوى الفكرة
function createIdeaCard(idea, id, userData, delay = 0) {
  const card = document.createElement("div");
  card.className = "idea-card";
  card.style.opacity = "0";
  card.style.transform = "translateY(10px)";
  card.style.transition = `opacity 0.3s ease ${delay}ms, transform 0.3s ease ${delay}ms`;

  const formattedDate = idea.createdAt?.toDate().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) || "Unknown date";

  const imageHtml = idea.imageUrl
    ? `<img src="${idea.imageUrl}" class="idea-image" alt="Idea Image" onerror="this.onerror=null; this.src='${getPlaceholderImage("Image")}';">`
    : "";
  const attachmentsHtml = idea.attachments?.length > 0
    ? `<div class="idea-attachments">
         <h4>Attachments:</h4>
         ${idea.attachments.map(attachment => renderAttachment(attachment)).join('')}
       </div>`
    : "";

  card.innerHTML = `
    <div class="idea-header">
      <div class="user-info">
        ${userData.photo
          ? `<img src="${userData.photo}" class="user-avatar" alt="${userData.name}" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`
          : `<div class="avatar-placeholder"><i data-lucide="user"></i></div>`}
        <div class="user-details">
          <span class="username">${userData.name}</span>
          ${userData.role ? `<span class="user-role">${userData.role}</span>` : ""}
        </div>
      </div>
      <span class="idea-date">${formattedDate}</span>
    </div>
    <h3 class="idea-title">${idea.title || "No title"}</h3>
    <div class="idea-content">
      <p>${idea.formattedContent || idea.content || "No content provided."}</p>
    </div>
    ${imageHtml}
    ${attachmentsHtml}
    <div class="idea-meta">
      <span>${idea.commentsCount || 0} comments</span>
      <button class="view-btn">
        <i data-lucide="message-square"></i> View Discussion
      </button>
    </div>
  `;

  ideaContainerEl.appendChild(card);

  setTimeout(() => {
    card.style.opacity = "1";
    card.style.transform = "translateY(0)";
  }, 50 + delay);

  card.querySelector(".view-btn").addEventListener("click", () => {
    window.location.href = `idea-community-view.html?communityId=${communityId}&ideaId=${id}`;
  });

  card.querySelectorAll(".attachment-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderAttachment(attachment) {
  const icon = getFileIcon(attachment.type);
  const fileName = attachment.name || getDefaultFileName(attachment.type);
  
  return `
    <div class="attachment-item">
      <i data-lucide="${icon}" class="attachment-icon"></i>
      <div class="attachment-info">
        <a href="${attachment.url}" target="_blank" class="attachment-link">
          ${fileName}
        </a>
        <small>${formatFileSize(attachment.size)} • ${getFileTypeLabel(attachment.type)}</small>
      </div>
    </div>
  `;
}

function getFileIcon(fileType) {
  switch(fileType.toLowerCase()) {
    case 'pdf': return 'file-text';
    case 'word': return 'file-text';
    case 'doc': return 'file-text';
    case 'docx': return 'file-text';
    case 'image': return 'image';
    default: return 'file';
  }
}

function getDefaultFileName(fileType) {
  switch(fileType.toLowerCase()) {
    case 'pdf': return 'Document.pdf';
    case 'word': return 'Document.docx';
    case 'doc': return 'Document.doc';
    case 'docx': return 'Document.docx';
    case 'image': return 'Image.jpg';
    default: return 'File';
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function getFileTypeLabel(fileType) {
  switch(fileType.toLowerCase()) {
    case 'pdf': return 'PDF';
    case 'word': return 'Word';
    case 'doc': return 'Word';
    case 'docx': return 'Word';
    case 'image': return 'Image';
    default: return fileType.toUpperCase();
  }
}

async function getUserInfo(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return getDefaultUserInfo();

    const userData = userDoc.data();
    return {
      name: userData.displayName || userData.username || userData.email || "Community Member",
      photo: userData.photoURL || null,
      role: userData.role || null,
    };
  } catch (error) {
    console.error("Error fetching user info:", error);
    return getDefaultUserInfo();
  }
}

function getUserDisplayInfo(user) {
  if (!user) return getDefaultUserInfo();
  return {
    name: user.displayName || user.email || "Community Member",
    photo: user.photoURL || null,
    role: null,
  };
}

function getDefaultUserInfo() {
  return { name: "Community Member", photo: null, role: null };
}

function showLoadingState(message) {
  ideaContainerEl.innerHTML = `
    <div class="loading-state">
      <i data-lucide="loader-2" class="animate-spin"></i>
      <p>${message}</p>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

function showEmptyState() {
  ideaContainerEl.innerHTML = `
    <div class="empty-state">
      <i data-lucide="lightbulb"></i>
      <h3>No Ideas Yet</h3>
      <p>Be the first to share an idea in this community</p>
      ${auth.currentUser ? `<button class="primary-btn" onclick="location.href='create-idea.html?communityId=${communityId}'"><i data-lucide="plus"></i> Share Your Idea</button>` : ""}
    </div>`;
  if (window.lucide) lucide.createIcons();
}

function showErrorPage(title, message, actions = []) {
  document.body.innerHTML = `
    <div class="error-page">
      <div class="error-content">
        <i data-lucide="alert-triangle"></i>
        <h2>${title}</h2>
        <p>${message}</p>
        <div class="action-buttons">
          ${actions.map((action) => action.url
            ? `<a href="${action.url}" class="action-btn">${action.text}</a>`
            : `<button onclick="${action.action}" class="action-btn">${action.text}</button>`).join("")}
        </div>
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${type === "success" ? "check-circle" : "alert-circle"}"></i>${message}`;
  document.body.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getPlaceholderImage(text = "Community") {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='150' viewBox='0 0 300 150'%3E%3Crect fill='%237c3aed' width='300' height='150'/%3E%3Ctext fill='white' font-family='Arial' font-size='24' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E${text}%3C/text%3E%3C/svg%3E`;
}