import { db, auth } from "./firebase-config.js"
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("myCommunitiesContainer")

  if (!container) {
    console.error("Error: #myCommunitiesContainer not found in HTML!")
    return
  }

  function renderCommunityCard(doc) {
    const data = doc.data()

    const card = document.createElement("div")
    card.className = "community-card"

    const title = document.createElement("h3")
    title.textContent = data.name

    const desc = document.createElement("p")
    desc.textContent = data.description || ""

    const openBtn = document.createElement("button")
    openBtn.textContent = "Open Community"
    openBtn.onclick = () => {
      window.location.href = `community.html?id=${doc.id}`
    }

    card.appendChild(title)
    card.appendChild(desc)
    card.appendChild(openBtn)
    container.appendChild(card)
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("Please log in first.")
      window.location.href = "login.html"
      return
    }

    const q = query(collection(db, "communities"), where("createdBy", "==", user.uid))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      container.innerHTML = "<p>You haven't created any communities yet.</p>"
    } else {
      querySnapshot.forEach((doc) => {
        renderCommunityCard(doc)
      })
    }
  })
})
