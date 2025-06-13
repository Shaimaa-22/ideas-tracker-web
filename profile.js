import { auth, db } from "./firebase-config.js"
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import {
  onAuthStateChanged,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

document.addEventListener("DOMContentLoaded", () => {
  const userNameSpan = document.getElementById("userName")
  const userEmailSpan = document.getElementById("userEmail")
  const userInitial = document.getElementById("userInitial")
  const burgerMenu = document.getElementById("burger")
  const editProfileBtn = document.getElementById("editProfileBtn")
  const deleteAccountBtn = document.getElementById("deleteAccountBtn")
  const dialog = document.getElementById("confirmDelete")
  const confirmYes = document.getElementById("confirmYes")
  const confirmNo = document.getElementById("confirmNo")
  const themeToggle = document.getElementById("themeToggle")
  const ideasContainer = document.getElementById("ideasContainer")

  if (!userNameSpan || !userEmailSpan || !userInitial) {
    console.error("Essential profile elements not found")
    return
  }

  window.toggleSidebar = () => {
    const sidebar = document.getElementById("sidebar")
    sidebar?.classList.toggle("show")
  }

  let currentUser = null

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user
      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDocSnap = await getDoc(userDocRef)

        if (userDocSnap.exists()) {
          const data = userDocSnap.data()
          const name = data.name || "User"
          userNameSpan.textContent = name
          userEmailSpan.textContent = user.email
          userInitial.textContent = name.charAt(0).toUpperCase()
        }

        if (ideasContainer) {
          await fetchUserIdeasInCommunities(user.uid)
        }
      } catch (error) {
        console.error("Error loading profile:", error)
        showError("Failed to load profile data.")
      }
    } else {
      window.location.href = "login.html"
    }
  })

  burgerMenu?.addEventListener("click", () => {
    document.getElementById("nav-links")?.classList.toggle("show")
  })

  editProfileBtn?.addEventListener("click", async () => {
    const newName = prompt("Enter your new name:")
    if (!newName || newName.trim().length < 2 || newName.length > 50) {
      alert("Name must be between 2 and 50 characters.")
      return
    }

    if (currentUser) {
      try {
        const userRef = doc(db, "users", currentUser.uid)
        await updateDoc(userRef, { name: newName.trim() })
        userNameSpan.textContent = newName
        userInitial.textContent = newName.charAt(0).toUpperCase()
      } catch (e) {
        console.error("Update failed", e)
        alert("Failed to update name.")
      }
    }
  })

  if (deleteAccountBtn && dialog && confirmYes && confirmNo) {
    deleteAccountBtn.addEventListener("click", () => {
      dialog.style.display = "block"
    })

    confirmNo.addEventListener("click", () => {
      dialog.style.display = "none"
    })

    confirmYes.addEventListener("click", async () => {
      if (!currentUser) return

      const userPassword = prompt("Please enter your password to delete your account:")
      if (!userPassword) {
        alert("Password is required.")
        return
      }

      try {
        const credential = EmailAuthProvider.credential(currentUser.email, userPassword)
        await reauthenticateWithCredential(currentUser, credential)
        await deleteDoc(doc(db, "users", currentUser.uid))
        await deleteUserIdeas(currentUser.uid)
        await deleteUser(currentUser)
        localStorage.clear()
        unsubscribe()
        window.location.href = "login.html"
      } catch (err) {
        console.error("Account deletion failed:", err)
        alert(`Failed to delete account: ${err.message}`)
      }
    })
  }

  if (themeToggle) initThemeToggle(themeToggle)

  async function fetchUserIdeasInCommunities(userId) {
    if (!ideasContainer) return

    ideasContainer.innerHTML = `
  <div class="skeleton-loader">
    <div class="skeleton-line"></div>
    <div class="skeleton-line"></div>
  </div>
`;

    try {
      const communitiesSnap = await getDocs(collection(db, "communities"))
      ideasContainer.innerHTML = ""
      let hasIdeas = false

      for (const communityDoc of communitiesSnap.docs) {
        const ideasSnap = await getDocs(collection(db, "communities", communityDoc.id, "ideas"))
        ideasSnap.forEach((ideaDoc) => {
          if (ideaDoc.data().createdBy === userId) {
            renderIdeaCard(communityDoc.id, communityDoc.data().name, ideaDoc.id, ideaDoc.data())
            hasIdeas = true
          }
        })
      }

      if (!hasIdeas) {
        ideasContainer.innerHTML = "<p>You haven't published any ideas yet.</p>"
      }
    } catch (error) {
      console.error("Error loading ideas:", error)
      ideasContainer.innerHTML = "<p>Failed to load your ideas. Please try again.</p>"
    }
  }

  async function deleteUserIdeas(userId) {
    try {
      const communitiesSnap = await getDocs(collection(db, "communities"))
      const deletePromises = []

      for (const communityDoc of communitiesSnap.docs) {
        const ideasSnap = await getDocs(collection(db, "communities", communityDoc.id, "ideas"))
        ideasSnap.forEach((ideaDoc) => {
          if (ideaDoc.data().createdBy === userId) {
            const ideaRef = doc(db, "communities", communityDoc.id, "ideas", ideaDoc.id)
            deletePromises.push(deleteDoc(ideaRef))
          }
        })
      }

      await Promise.all(deletePromises)
    } catch (error) {
      console.error("Error deleting user ideas:", error)
      throw error
    }
  }

  function renderIdeaCard(communityId, communityName, ideaId, idea) {
    const card = document.createElement("div")
    card.className = "idea-card"
    card.innerHTML = `
      <h3>${escapeHtml(idea.title || "Untitled Idea")}</h3>
      <p>${escapeHtml(idea.content || "No content")}</p>
      <small>In: ${escapeHtml(communityName || "Unknown Community")}</small>
      <small>${idea.createdAt?.toDate().toLocaleString() || "Unknown date"}</small>
      <div class="idea-actions">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </div>
    `

    card.querySelector(".edit-btn").addEventListener("click", () => {
      window.location.href = `idea.html?id=${ideaId}&community=${communityId}`
    })

    card.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this idea?")) {
        try {
          await deleteDoc(doc(db, "communities", communityId, "ideas", ideaId))
          card.remove()
        } catch (error) {
          console.error("Error deleting idea:", error)
          alert("Failed to delete idea. Please try again.")
        }
      }
    })

    ideasContainer.appendChild(card)
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  function initThemeToggle(toggleElement) {
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    const isDark = savedTheme === "dark" || (!savedTheme && prefersDark)
    document.documentElement.classList.toggle("dark", isDark)
    toggleElement.innerHTML = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>'

    toggleElement.addEventListener("click", () => {
      const darkNow = document.documentElement.classList.toggle("dark")
      localStorage.setItem("theme", darkNow ? "dark" : "light")
      toggleElement.innerHTML = darkNow ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>'
      if (window.lucide) lucide.createIcons()
    })

    if (window.lucide) lucide.createIcons()
  }

  function showError(message) {
    const errorElement = document.createElement("div")
    errorElement.className = "error-message"
    errorElement.textContent = message
    document.body.prepend(errorElement)
    setTimeout(() => errorElement.remove(), 5000)
  }
})
