import { db, auth } from "./firebase-config.js"
import {
  doc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

const urlParams = new URLSearchParams(window.location.search)
const communityId = urlParams.get("communityId")
const ideaId = urlParams.get("ideaId")

const titleEl = document.getElementById("ideaTitle")
const contentEl = document.getElementById("ideaContent")
const authorInfoEl = document.getElementById("authorInfo")
const commentsContainer = document.getElementById("commentsContainer")
const newCommentInput = document.getElementById("newComment")
const submitBtn = document.getElementById("submitComment")
const imageContainer = document.getElementById("ideaImageContainer")

let currentUser = null
const lucide = window.lucide 
function getPlaceholderImage(text = "Image") {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='150' viewBox='0 0 300 150'%3E%3Crect fill='%237c3aed' width='300' height='150'/%3E%3Ctext fill='white' font-family='Arial' font-size='24' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E${text}%3C/text%3E%3C/svg%3E`
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please log in first.")
    window.location.href = "login.html"
    return
  }

  currentUser = user
  loadIdea()
  listenToComments()
})

async function loadIdea() {
  try {
    const ideaRef = doc(db, "communities", communityId, "ideas", ideaId)
    const snapshot = await getDoc(ideaRef)

    if (snapshot.exists()) {
      const data = snapshot.data()
      titleEl.textContent = data.title || "Untitled Idea"
      contentEl.innerHTML = data.formattedContent || `<p>${data.content || "No content provided."}</p>`
      loadAuthorInfo(data.createdBy || data.userId, data.authorName)
      if (data.imageUrl) {
        displayImage(data.imageUrl)
      } else if (data.attachments && data.attachments.length > 0) {
        const imageAttachment = data.attachments.find((att) => att.type === "image")
        if (imageAttachment) {
          displayImage(imageAttachment.url)
        }
      }
    } else {
      titleEl.textContent = "Idea not found."
      contentEl.innerHTML = "<p>The requested idea could not be found.</p>"
    }
  } catch (error) {
    console.error("Error loading idea:", error)
    contentEl.innerHTML = "<p>Error loading idea. Please try again later.</p>"
  }
}

function displayImage(imageUrl) {
  imageContainer.innerHTML = ""
  const img = document.createElement("img")
  img.src = imageUrl
  img.alt = "Idea Image"
  img.className = "idea-detail-image"
  img.onerror = function () {
    this.onerror = null
    this.src = getPlaceholderImage("Image Not Available")
    console.warn("Failed to load image, using placeholder instead")
  }

  imageContainer.appendChild(img)
  imageContainer.style.display = "block"
}

async function loadAuthorInfo(authorId, authorName) {
  if (!authorId) {
    authorInfoEl.innerHTML = `
      <div class="avatar-placeholder"><i data-lucide="user"></i></div>
      <span>Unknown Author</span>
    `
    if (window.lucide) lucide.createIcons()
    return
  }

  try {
    const userDoc = await getDoc(doc(db, "users", authorId))
    let userName = authorName || "Community Member"
    let photoURL = null

    if (userDoc.exists()) {
      const userData = userDoc.data()
      userName = userData.name || userData.displayName || authorName || "Community Member"
      photoURL = userData.photoURL || null
    }

    authorInfoEl.innerHTML = photoURL
      ? `<img src="${photoURL}" class="user-avatar" alt="${userName}" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="avatar-placeholder" style="display:none"><i data-lucide="user"></i></div>
         <span>${userName}</span>`
      : `<div class="avatar-placeholder"><i data-lucide="user"></i></div>
         <span>${userName}</span>`

    if (window.lucide) lucide.createIcons()
  } catch (error) {
    console.error("Error loading author info:", error)
    authorInfoEl.innerHTML = `
      <div class="avatar-placeholder"><i data-lucide="user"></i></div>
      <span>${authorName || "Community Member"}</span>
    `
    if (window.lucide) lucide.createIcons()
  }
}

function listenToComments() {
  const commentsRef = collection(db, "communities", communityId, "ideas", ideaId, "comments")
  onSnapshot(commentsRef, (snapshot) => {
    commentsContainer.innerHTML = ""
    if (snapshot.empty) {
      commentsContainer.innerHTML = "<p class='no-comments'>No comments yet. Be the first to comment!</p>"
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data()
      const div = document.createElement("div")
      div.className = "comment"

      const isMe = data.createdBy === currentUser.uid
      if (isMe) {
        div.classList.add("my-comment")
      }

      const text = document.createElement("p")
      text.textContent = data.text

      const meta = document.createElement("div")
      meta.className = "comment-meta"
      const who = isMe ? "You" : data.authorName || "Anonymous"
      const when = data.createdAt?.toDate().toLocaleString() || "just now"
      meta.textContent = `${who} — ${when}`

      div.appendChild(text)
      div.appendChild(meta)

      if (isMe) {
        const actionButtons = document.createElement("div")
        actionButtons.className = "comment-actions"

        const editBtn = document.createElement("button")
        editBtn.className = "edit-comment-btn"
        editBtn.innerHTML = '<i data-lucide="edit-2"></i> Edit'
        editBtn.onclick = async () => {
          const newText = prompt("Edit your comment:", data.text)
          if (newText && newText !== data.text) {
            const commentDocRef = doc(db, "communities", communityId, "ideas", ideaId, "comments", docSnap.id)
            await updateDoc(commentDocRef, {
              text: newText,
              editedAt: serverTimestamp(),
            })
          }
        }

        const deleteBtn = document.createElement("button")
        deleteBtn.className = "delete-comment-btn"
        deleteBtn.innerHTML = '<i data-lucide="trash-2"></i> Delete'
        deleteBtn.onclick = async () => {
          if (confirm("Delete this comment?")) {
            await deleteDoc(doc(db, "communities", communityId, "ideas", ideaId, "comments", docSnap.id))
          }
        }

        actionButtons.appendChild(editBtn)
        actionButtons.appendChild(deleteBtn)
        div.appendChild(actionButtons)
      }

      commentsContainer.appendChild(div)
    })

    if (window.lucide) lucide.createIcons()
  })
}

submitBtn.addEventListener("click", async () => {
  const commentText = newCommentInput.value.trim()
  if (!commentText) return

  submitBtn.disabled = true
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i>'
  if (window.lucide) lucide.createIcons()

  try {
    const userDocRef = doc(db, "users", currentUser.uid)
    const userSnap = await getDoc(userDocRef)
    const authorName = userSnap.exists() ? userSnap.data().name || "Unknown" : "Unknown"

    const commentRef = collection(db, "communities", communityId, "ideas", ideaId, "comments")
    await addDoc(commentRef, {
      text: commentText,
      createdBy: currentUser.uid,
      authorName: authorName,
      createdAt: serverTimestamp(),
    })

    newCommentInput.value = ""
    submitBtn.disabled = false
    submitBtn.innerHTML = '<i data-lucide="send"></i> Send'
    if (window.lucide) lucide.createIcons()
  } catch (error) {
    console.error("Error adding comment:", error)
    alert("Failed to add comment. Please try again.")
    submitBtn.disabled = false
    submitBtn.innerHTML = '<i data-lucide="send"></i> Send'
    if (window.lucide) lucide.createIcons()
  }
})
