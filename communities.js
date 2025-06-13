// هون بنجيب قاعدة البيانات (db) ونظام الدخول (auth)
import { db, auth } from "./firebase-config.js"
import {
  collection,
  getDocs,
  doc,
  query,
  setDoc,
  getDoc,
} // استيراد دوال من Firebase Firestore للتعامل مع البيانات
from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
// هاي لتراقب إذا المستخدم مسجّل دخول أو لأ
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
 
// مكان عرض كروت المجتمعات
const communityListEl = document.getElementById("communityList")
const lucide = window.lucide || {
  createIcons: () => {
    console.warn("Lucide library not loaded yet")
  },
}
  // بتعرض رسالة صغيرة على الشاشة (نجاح أو خطأ)
function showToast(message, type = "success") {
  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.innerHTML = `
    <i data-lucide="${type === "success" ? "check-circle" : "alert-circle"}"></i>
    ${message}
  `
  document.body.appendChild(toast)

  if (window.lucide) {
    lucide.createIcons()
  }

  setTimeout(() => {
    toast.style.opacity = "0"
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
  // بنجيب عدد الأشخاص اللي داخل المجتمع من قاعدة البيانات
async function getMembersCount(communityId) {
  try {
    const membersRef = collection(db, "communities", communityId, "members")
    const snapshot = await getDocs(membersRef)
    return snapshot.size
  } catch (error) {
    console.error("Error getting members count:", error)
    return 0
  }
}
// نرجّع صورة افتراضية باسم المجتمع

function getPlaceholderImage(text = "Community") {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='150' viewBox='0 0 300 150'%3E%3Crect fill='%237c3aed' width='300' height='150'/%3E%3Ctext fill='white' font-family='Arial' font-size='24' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E${text}%3C/text%3E%3C/svg%3E`
}
// بنعرض كرت المجتمع
async function renderCommunity(communityId, data, userId) {
  const container = document.createElement("div")
  container.className = "community-card"
    // الصورة
  const communityImage = document.createElement("div")
  communityImage.className = "community-image"
  const imageUrl = data.imageURL || getPlaceholderImage(data.name || "Community")
  communityImage.style.backgroundImage = `url("${imageUrl}")`
    // معلومات المجتمع
  communityImage.innerHTML = `
    <div class="image-fallback" style="display: none; height: 100%; width: 100%; 
         background-color: #7c3aed; color: white; 
         display: flex; align-items: center; justify-content: center; 
         font-size: 18px; text-align: center; padding: 10px;">
      ${data.name || "Community"}
    </div>
  `
  const communityInfo = document.createElement("div")
  communityInfo.className = "community-info"

  const name = document.createElement("h3")
  name.textContent = data.name

  const desc = document.createElement("p")
  desc.className = "community-description"
  desc.textContent = data.description || "No description provided."

  const metaInfo = document.createElement("div")
  metaInfo.className = "community-meta"

  const membersCount = await getMembersCount(communityId)
  const membersInfo = document.createElement("span")
  membersInfo.innerHTML = `<i data-lucide="users"></i> ${membersCount} members`

  const privacyBadge = document.createElement("span")
  privacyBadge.className = `privacy-badge ${data.isPrivate ? "private" : "public"}`
  privacyBadge.innerHTML = `<i data-lucide="${data.isPrivate ? "lock" : "globe"}"></i> ${data.isPrivate ? "Private" : "Public"}`

  metaInfo.appendChild(membersInfo)
  metaInfo.appendChild(privacyBadge)
    // الزر (انضمام / فتح المجتمع)
  const actionBtn = document.createElement("button")
  actionBtn.className = "action-button"

  const memberRef = doc(db, "communities", communityId, "members", userId)
  const memberSnap = await getDoc(memberRef)

  if (memberSnap.exists() && memberSnap.data().isApproved) {
    actionBtn.textContent = "Open Community"
    actionBtn.classList.add("primary-button")
    actionBtn.onclick = () => {
      window.location.href = `community.html?id=${communityId}`
    }
  } else {
    actionBtn.textContent = data.isPrivate ? "Request to Join" : "Join Community"
    actionBtn.classList.add(data.isPrivate ? "secondary-button" : "primary-button")
    actionBtn.onclick = () => handleJoinRequest(communityId, data.isPrivate)
  }
    // تركيب الكرت
  communityInfo.appendChild(name)
  communityInfo.appendChild(desc)
  communityInfo.appendChild(metaInfo)
  communityInfo.appendChild(actionBtn)
  container.appendChild(communityImage)
  container.appendChild(communityInfo)
  communityListEl.appendChild(container)
  if (window.lucide) {
    lucide.createIcons()
  }
}
 // إذا المستخدم مش داخل، بنطلب منه يسجّل دخول

  // لو خاص:
  // بنسجّل طلب انضمام بـ status = "pending"

  // لو عام:
  // بنضيفه كعضو مباشرة
async function handleJoinRequest(communityId, isPrivate) {
  if (!auth.currentUser) {
    showToast("Please login first.", "error")
    return
  }

  const userId = auth.currentUser.uid

  try {
    if (isPrivate) {
      const requestRef = doc(db, "communities", communityId, "joinRequests", userId)
      const requestSnap = await getDoc(requestRef)

      if (requestSnap.exists()) {
        const status = requestSnap.data().status
        if (status === "pending") {
          showToast("You already have a pending request for this community.", "info")
          return
        } else if (status === "approved") {
          showToast("You are already a member of this community.", "info")
          return
        }
      }

      await setDoc(requestRef, {
        userId,
        communityId,
        status: "pending",
        requestedAt: new Date(),
      })
      showToast("Join request sent! Please wait for approval.")
    } else {
      const memberRef = doc(db, "communities", communityId, "members", userId)
      const memberSnap = await getDoc(memberRef)

      if (memberSnap.exists()) {
        showToast("You are already a member of this community.", "info")
        return
      }

      await setDoc(memberRef, {
        userId,
        joinedAt: new Date(),
        isApproved: true,
        canPost: true,
      })
      showToast("You have successfully joined the community!")
      setTimeout(() => loadCommunities(), 500)
    }
  } catch (err) {
    console.error("Join error:", err)
    showToast("Failed to join. Please try again.", "error")
  }
}
// أول شي بنعرض حالة تحميل
  // بعدين بنجيب كل المجتمعات من قاعدة البيانات
  // لو ما في مجتمعات: بنعرض رسالة "ما في مجتمعات"
  // غير هيك، بنعرضهم واحد واحد باستخدام renderCommunity
async function loadCommunities() {
  communityListEl.innerHTML = `
    <div class="loading-state">
      <i data-lucide="loader-2" class="animate-spin"></i>
      <p>Loading communities...</p>
    </div>
  `
  if (window.lucide) {
    lucide.createIcons()
  }
  try {
    const q = query(collection(db, "communities"))
    const snapshot = await getDocs(q)
    communityListEl.innerHTML = ""
    if (snapshot.empty) {
      communityListEl.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users"></i>
          <p>No communities found</p>
          <a href="create-community.html" class="primary-button">Create New Community</a>
        </div>
      `
      if (window.lucide) {
        lucide.createIcons()
      }
      return
    }

    const loadingPromises = []
    for (const docSnap of snapshot.docs) {
      loadingPromises.push(renderCommunity(docSnap.id, docSnap.data(), auth.currentUser?.uid))
    }

    await Promise.all(loadingPromises)
  } catch (err) {
    console.error("Error loading communities:", err)
    communityListEl.innerHTML = `
      <div class="error-state">
        <i data-lucide="alert-triangle"></i>
        <p>Failed to load communities</p>
        <button onclick="loadCommunities()" class="secondary-button">Try Again</button>
      </div>
    `

    if (window.lucide) {
      lucide.createIcons()
    }
  }
}
    // إذا المستخدم مسجّل دخول، بنعرض المجتمعات
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadCommunities()
  } else {    // إذا مش مسجّل، بنطلب منه يسجّل دخول
    communityListEl.innerHTML = `
      <div class="auth-prompt">
        <i data-lucide="log-in"></i>
        <p>Please log in to see available communities</p>
        <a href="login.html" class="primary-button">Login</a>
      </div>
    `
    if (window.lucide) {
      lucide.createIcons()
    }
  }
})
