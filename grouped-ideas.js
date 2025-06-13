import { loadIdeasFromFirestore } from "./firestore-logic.js"
export async function renderGroupedIdeas() {
  const container = document.getElementById("groupedIdeasContainer")
  container.innerHTML = ""

  try {
    const ideas = await loadIdeasFromFirestore()

    if (ideas.length === 0) {
      container.innerHTML = `<p style="text-align: center; padding: 2rem; color: #777;">No ideas found.</p>`
      return
    }

    const grouped = {}
    // تحميل الأفكار وتجميعها حسب التصنيف (topic)
    ideas.forEach((idea) => {
      const topic = idea.topic || "Unspecified"// في حال ما في topic
      if (!grouped[topic]) grouped[topic] = []  // إنشاء مصفوفة جديدة إذا ما كانت موجودة
      grouped[topic].push(idea)
    })
//  لكل مجموعة مواضيع، بننشئ بلوك كامل فيه عنوان ومجموعة أفكار
    Object.keys(grouped).forEach((topic) => {
      const topicBlock = document.createElement("div")
      topicBlock.className = "topic-group"

      topicBlock.innerHTML = `
        <div class="topic-title">
          ${topic}
          <i data-lucide="chevron-down"></i>
        </div>
        <div class="idea-group-content"></div>
      `

      const ideaGroupContent = topicBlock.querySelector(".idea-group-content")

      grouped[topic].forEach((idea) => {
        const card = document.createElement("div")
        card.className = "idea-card"
        card.innerHTML = `
          <div class="idea-content">
            ${idea.content.slice(0, 150)}...
          </div>
          <div class="idea-actions" style="margin-top: 0.5rem;">
            <a href="idea.html?id=${idea.id}" class="view-link">
              <i data-lucide="file-text"></i> View
            </a>
          </div>
        `
        ideaGroupContent.appendChild(card)
      })
      topicBlock.querySelector(".topic-title").addEventListener("click", () => {
        topicBlock.classList.toggle("open")// تفتح أو تسكر المجموعة
      })

      container.appendChild(topicBlock)
    })
//  التعامل مع الأخطاء عند فشل التحميل
    if (window.lucide) lucide.createIcons()
  } catch (err) {
    console.error("Error loading grouped ideas:", err)
    container.innerHTML = `<p style="color: red; text-align: center; padding: 2rem;">Failed to load grouped ideas.</p>`
  }
}
