// استيراد مكتبات وخدمات Firebase وملفات من المشروع
import { auth } from "./firebase-config.js"
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { saveIdeaToFirestore, loadIdeasFromFirestore, deleteIdeaFromFirestore } from "./firestore-logic.js"

// بنراقب إذا المستخدم مسجّل دخول أو لأ
onAuthStateChanged(auth, (user) => {
  if (!user) {     // إذا مش مسجّل، بنرجعه على صفحة تسجيل الدخول
    window.location.href = "login.html"
  } else {
    const appContainer = document.querySelector(".app-container")
    if (appContainer) {
      appContainer.style.opacity = "0"
      appContainer.style.transform = "scale(0.95)"
      setTimeout(() => {
        appContainer.style.transition = "opacity 0.5s ease, transform 0.5s ease"
        appContainer.style.opacity = "1"
        appContainer.style.transform = "scale(1)"
      }, 100)
    }
  }
})

// لما المستخدم يضغط على زر الخروج
const logoutButton = document.getElementById("logoutButton")
logoutButton.addEventListener("click", () => {
  const appContainer = document.querySelector(".app-container")
  if (appContainer) {
    appContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease"
    appContainer.style.opacity = "0"
    appContainer.style.transform = "scale(0.95)"
  }

  setTimeout(() => {
    signOut(auth).then(() => {
      localStorage.removeItem("uid")
      window.location.href = "login.html"
    })
  }, 300)
})
// بعد تحميل الصفحة بالكامل، نبدأ بتجهيز العناصر والمنطق البرمجي

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons()
  }
    // تعريف عناصر واجهة المستخدم المختلفة (أزرار، نصوص، أقسام)
  const recordButton = document.getElementById("recordButton")
  const languageButton = document.getElementById("languageButton")
  const languageText = document.getElementById("languageText")
  const transcript = document.getElementById("transcript")
  const clearButton = document.getElementById("clearButton")
  const saveButton = document.getElementById("saveButton")
  const recordingIndicator = document.getElementById("recordingIndicator")
  const recordingTime = document.getElementById("recordingTime")
  const status = document.getElementById("status")
  const charCount = document.getElementById("charCount")
  const tabButtons = document.querySelectorAll(".tab-button")
  const tabContents = document.querySelectorAll(".tab-content")
  const refreshIdeasButton = document.getElementById("refreshIdeas")
  const ideasList = document.getElementById("ideasList")
  const chatbotContainer = document.getElementById("chatbot-container")
  const chatbotIcon = document.getElementById("chatbot-icon")
  const closeBtn = document.getElementById("close-btn")
  const sendBtn = document.getElementById("send-btn")
  const chatbotInput = document.getElementById("chatbot-input")
  const chatbotMessages = document.getElementById("chatbot-messages")
  const sendToAIButton = document.getElementById("sendToAIButton")
  const mindMapTextBtn = document.getElementById("mindMapTextBtn")
  const mindMapTextOutput = document.getElementById("mindmap-text-output")

    // متغيرات خاصة بالحالة
  let isRecording = false
  let recognition = null
  let currentLanguage = "en-US"
  let recordingStartTime = null
  let recordingTimer = null
  let isSaving = false

    // دالة بتعرض إشعار صغير عالشاشة
  function showToast(message, type = "success") {
        // أول شي بنشيل أي إشعار قديم
    const existingToasts = document.querySelectorAll(".toast")
    existingToasts.forEach((toast) => {
      toast.style.animation = "fadeOut 0.3s ease forwards"
      setTimeout(() => toast.remove(), 300)
    })
    // بنعمل إشعار جديد

    const toast = document.createElement("div")
    toast.className = `toast ${type}`
    toast.innerHTML = `
      <i data-lucide="${type === "success" ? "check-circle" : "alert-circle"}"></i>
      ${message}
    `
    document.body.appendChild(toast)
    if (window.lucide) {
      window.lucide.createIcons()
    }
    // بنعمل أنيميشن للإشعار
    toast.style.animation = "slideUp 0.3s ease"

    setTimeout(() => {
      toast.style.animation = "fadeOut 0.3s ease forwards"
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }
  window.showToast = showToast
  // دالة بتحسب كم حرف كتبنا
  function updateCharCount() {
    const count = transcript.value.length
    const countElement = document.getElementById("charCount")

    countElement.style.transition = "transform 0.2s ease, color 0.2s ease"
    countElement.style.transform = "scale(1.2)"
    countElement.textContent = count
    // تغيير اللون حسب عدد الأحرف
    if (count > 4000) {
      countElement.style.color = "#ef4444"
    } else if (count > 3000) {
      countElement.style.color = "#f59e0b"
    } else {
      countElement.style.color = ""
    }

    setTimeout(() => {
      countElement.style.transform = "scale(1)"
    }, 200)
    // تحذير إذا قربنا نوصل الحد المسموح
    if (count >= 4900) {
      showToast("Approaching character limit!", "error")
    }
  }
    // دالة بتعرض وقت التسجيل كل ثانية
  function updateRecordingTime() {
    if (!recordingStartTime) return
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, "0")
    const seconds = (elapsed % 60).toString().padStart(2, "0")
    recordingTime.style.transition = "transform 0.2s ease"
    recordingTime.style.transform = "scale(1.1)"
    recordingTime.textContent = `${minutes}:${seconds}`

    setTimeout(() => {
      recordingTime.style.transform = "scale(1)"
    }, 200)
  }
    // دالة بتحول التاريخ لشكل حلو للعرض
  function formatDate(dateString) {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }
  // دالة بتجيب كل الأفكار من قاعدة البيانات وتعرضهم
  async function loadIdeas() {
    ideasList.innerHTML = `
      <div class="idea-card loading">
        <div style="height: 150px; display: flex; align-items: center; justify-content: center;">
          <i data-lucide="loader-2" class="animate-spin" style="width: 2rem; height: 2rem; color: var(--primary);"></i>
        </div>
      </div>
    `
    if (window.lucide) {
      window.lucide.createIcons()
    }

    try {
      const ideas = await loadIdeasFromFirestore()
      setTimeout(() => {
        ideasList.innerHTML = ""

        if (ideas.length === 0) {
          const emptyState = document.createElement("div")
          emptyState.className = "idea-card"
          emptyState.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
              <i data-lucide="lightbulb" style="width: 3rem; height: 3rem; margin: 0 auto 1rem; color: var(--primary-light);"></i>
              <p>No ideas saved yet. Start recording your first idea!</p>
              <button class="primary-button" style="margin-top: 1rem;" onclick="document.querySelector('[data-tab=\\'recorder\\']').click()">
                <i data-lucide="mic"></i> Record an Idea
              </button>
            </div>
          `
          ideasList.appendChild(emptyState)
          if (window.lucide) {
            window.lucide.createIcons()
          }
          return
        }
      // بنمر على كل فكرة ونحطها في كرت
        ideas.forEach((idea, index) => {
          setTimeout(() => {
            const card = document.createElement("div")
            card.className = "idea-card"
            card.style.opacity = "0"
            card.style.transform = "translateY(20px)"
            card.innerHTML = `
            <div class="idea-header">
              <div class="idea-meta">
                <div><i data-lucide="calendar"></i> ${formatDate(idea.timestamp)}</div>
                <div><i data-lucide="globe-2"></i> ${idea.language === "en-US" ? "English" : "Arabic"}</div>
              </div>
            </div>
          
            <div class="idea-content">
              ${idea.content.slice(0, 150)}...
            </div>
          
            <div class="idea-actions" style="margin-top: 1rem; display: flex; gap: 1rem;">
              <a href="idea.html?id=${idea.id}" class="view-link">
                <i data-lucide="file-text"></i> View
              </a>
              <button class="delete-button" onclick="deleteIdea('${idea.id}')">
                <i data-lucide="trash-2"></i> Delete
              </button>
            </div>
          `

            ideasList.appendChild(card)
            setTimeout(() => {
              card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
              card.style.opacity = "1"
              card.style.transform = "translateY(0)"
            }, 50)

            if (window.lucide) {
              window.lucide.createIcons()
            }
          }, index * 100) 
        })
      }, 300)
    } catch (error) {
      ideasList.innerHTML = `
        <div class="idea-card" style="text-align: center; padding: 2rem;">
          <i data-lucide="alert-triangle" style="width: 2rem; height: 2rem; margin: 0 auto 1rem; color: var(--danger);"></i>
          <p>Failed to load ideas. Please try again.</p>
          <button class="secondary-button" style="margin-top: 1rem;" onclick="loadIdeas()">
            <i data-lucide="refresh-cw"></i> Try Again
          </button>
        </div>
      `
      if (window.lucide) {
        window.lucide.createIcons()
      }
      showToast("Failed to load ideas.", "error")
    }
  }
  window.loadIdeas = loadIdeas

  window.deleteIdea = async (id) => {
    const confirmDialog = document.createElement("div")
    confirmDialog.className = "toast"
    confirmDialog.style.animation = "none"
    confirmDialog.style.bottom = "50%"
    confirmDialog.style.transform = "translate(-50%, 50%)"
    confirmDialog.style.padding = "1.5rem"
    confirmDialog.style.width = "300px"
    confirmDialog.style.textAlign = "center"
    confirmDialog.innerHTML = `
      <div style="margin-bottom: 1rem;">Are you sure you want to delete this idea?</div>
      <div style="display: flex; gap: 0.5rem; justify-content: center;">
        <button id="confirm-delete" class="primary-button" style="background: var(--danger); padding: 0.5rem 1rem;">Delete</button>
        <button id="cancel-delete" class="secondary-button" style="padding: 0.5rem 1rem;">Cancel</button>
      </div>
    `
    document.body.appendChild(confirmDialog)
    setTimeout(() => {
      confirmDialog.style.transition = "opacity 0.3s ease, transform 0.3s ease"
      confirmDialog.style.opacity = "1"
      confirmDialog.style.transform = "translate(-50%, 50%) scale(1)"
    }, 10)
    document.getElementById("confirm-delete").addEventListener("click", async () => {
      confirmDialog.style.opacity = "0"
      confirmDialog.style.transform = "translate(-50%, 50%) scale(0.9)"

      setTimeout(() => {
        confirmDialog.remove()
        const cards = document.querySelectorAll(".idea-card")
        let targetCard = null

        cards.forEach((card) => {
          if (card.innerHTML.includes(id)) {
            targetCard = card
          }
        })

        if (targetCard) {
          targetCard.style.transition = "opacity 0.3s ease, transform 0.3s ease"
          targetCard.style.opacity = "0"
          targetCard.style.transform = "translateX(20px)"
        }
        setTimeout(async () => {
          try {
            await deleteIdeaFromFirestore(id)
            loadIdeas()
            showToast("Idea deleted successfully")
          } catch (error) {
            showToast("Failed to delete idea.", "error")
          }
        }, 300)
      }, 300)
    })

    document.getElementById("cancel-delete").addEventListener("click", () => {
      confirmDialog.style.opacity = "0"
      confirmDialog.style.transform = "translate(-50%, 50%) scale(0.9)"
      setTimeout(() => confirmDialog.remove(), 300)
    })
  }
  // دالة لحفظ الفكرة في قاعدة البيانات
  async function saveIdea() {
    if (isSaving) return
    const content = transcript.value.trim()
    if (!content) {
      showToast("Nothing to save", "error")
      return
    }
    isSaving = true
    saveButton.classList.add("saving")
    saveButton.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i>'
    if (window.lucide) {
      window.lucide.createIcons()
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await saveIdeaToFirestore(content, currentLanguage)
      saveButton.innerHTML = '<i data-lucide="check"></i>'
      if (window.lucide) {
        window.lucide.createIcons()
      }

      setTimeout(() => {
        showToast("Idea saved successfully!")
        transcript.value = ""
        updateCharCount()
        const ideasTab = document.querySelector('[data-tab="ideas"]')
        ideasTab.click()
        saveButton.classList.remove("saving")
        saveButton.innerHTML = '<i data-lucide="save"></i>'
        if (window.lucide) {
          window.lucide.createIcons()
        }
        isSaving = false
      }, 500)
    } catch (error) {
      showToast("Error saving idea.", "error")
      saveButton.classList.remove("saving")
      saveButton.innerHTML = '<i data-lucide="save"></i>'
      if (window.lucide) {
        window.lucide.createIcons()
      }
      isSaving = false
    }
  }
  // نضبط أداة التعرف على الصوت حسب اللغة المختارة
  function initializeSpeechRecognition() {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = currentLanguage
    // أول ما يبدأ التسجيل
      recognition.onstart = () => {
        status.textContent = "Listening..."
        status.style.color = "var(--primary)"
        recordingIndicator.classList.add("active")
      }
    // لما يخلص التسجيل
      recognition.onend = () => {
        if (isRecording) recognition.start()
        else {
          status.textContent = "Ready to record"
          status.style.color = ""
          recordingIndicator.classList.remove("active")
        }
      }
    // كل مرة يتعرّف فيها على كلام، بنحط النص بحقل النصوص
      recognition.onresult = (event) => {
        const transcriptText = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("")
        transcript.style.transition = "background-color 0.3s ease"
        transcript.style.backgroundColor = "rgba(124, 58, 237, 0.05)"
        transcript.value = transcriptText
        updateCharCount()

        setTimeout(() => {
          transcript.style.backgroundColor = ""
        }, 300)
      }

      recognition.onerror = (event) => {
        showToast(`Error: ${event.error}`, "error")
        stopRecording()
      }
    } else {
      showToast("Speech recognition not supported", "error")
      recordButton.disabled = true
    }
  }

  function startRecording() {
    if (recognition) {
      try {
        recognition.start()
        isRecording = true
        recordButton.style.transition = "all 0.3s ease"
        recordButton.classList.add("recording")
        recordButton.innerHTML = '<i data-lucide="mic-off"></i> Stop Recording'
        if (window.lucide) {
          window.lucide.createIcons()
        }

        recordingStartTime = Date.now()
        recordingTimer = setInterval(updateRecordingTime, 1000)
        status.style.transition = "color 0.3s ease"
        status.style.color = "var(--primary)"

        showToast("Recording started")
      } catch (error) {
        showToast("Error starting recording.", "error")
        stopRecording()
      }
    }
  }

  function stopRecording() {
    if (recognition) {
      recognition.stop()
      isRecording = false
      recordButton.classList.remove("recording")
      recordButton.innerHTML = '<i data-lucide="mic"></i> Start Recording'
      if (window.lucide) {
        window.lucide.createIcons()
      }

      clearInterval(recordingTimer)
      recordingStartTime = null
      recordingTime.textContent = "00:00"
      status.style.color = ""

      showToast("Recording stopped")
    }
  }
  const tabIdMap = {
    recorder: "recorder-tab",
    ideas: "ideas-tab",
    groupedIdeas: "groupedIdeasSection",
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab
      tabButtons.forEach((btn) => {
        btn.classList.remove("active")
        btn.style.transition = "all 0.3s ease"
      })

      tabContents.forEach((content) => {
        content.style.animation = "none"
        content.classList.remove("active")
      })

      button.classList.add("active")
      const targetTabId = tabIdMap[tabName]
      const targetTab = document.getElementById(targetTabId)
      if (targetTab) {
        targetTab.classList.add("active")
        targetTab.style.animation = "fadeIn 0.5s ease"
      }

      if (tabName === "ideas") loadIdeas() // لما نفتح تبويب الأفكار، بنعمل تحميل 
    })
  })
    // زر تسجيل الصوت
  if (recordButton) {
    recordButton.addEventListener("click", () => {
      if (isRecording) stopRecording()
      else startRecording()
    })
  }
    // تغيير اللغة بين عربي وإنجليزي
  if (languageButton) {
    languageButton.addEventListener("click", () => {
      if (isRecording) stopRecording()
      languageButton.style.transition = "transform 0.3s ease"
      languageButton.style.transform = "rotate(30deg)"

      setTimeout(() => {
        currentLanguage = currentLanguage === "en-US" ? "ar-SA" : "en-US"
        languageText.textContent = currentLanguage === "en-US" ? "English" : "العربية"
        transcript.dir = currentLanguage === "ar-SA" ? "rtl" : "ltr"
        if (recognition) recognition.lang = currentLanguage

        languageButton.style.transform = "rotate(0deg)"
        showToast(`Language changed to ${languageText.textContent}`)
      }, 300)
    })
  }
  // زر مسح النص المكتوب بعد تأكيد
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      if (transcript.value.trim()) {
        const confirmDialog = document.createElement("div")
        confirmDialog.className = "toast"
        confirmDialog.style.animation = "none"
        confirmDialog.style.bottom = "50%"
        confirmDialog.style.transform = "translate(-50%, 50%)"
        confirmDialog.style.padding = "1.5rem"
        confirmDialog.style.width = "300px"
        confirmDialog.style.textAlign = "center"
        confirmDialog.innerHTML = `
          <div style="margin-bottom: 1rem;">Are you sure you want to clear the transcript?</div>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button id="confirm-clear" class="primary-button" style="background: var(--danger); padding: 0.5rem 1rem;">Clear</button>
            <button id="cancel-clear" class="secondary-button" style="padding: 0.5rem 1rem;">Cancel</button>
          </div>
        `
        document.body.appendChild(confirmDialog)
        setTimeout(() => {
          confirmDialog.style.transition = "opacity 0.3s ease, transform 0.3s ease"
          confirmDialog.style.opacity = "1"
          confirmDialog.style.transform = "translate(-50%, 50%) scale(1)"
        }, 10)
        document.getElementById("confirm-clear").addEventListener("click", () => {
          confirmDialog.style.opacity = "0"
          confirmDialog.style.transform = "translate(-50%, 50%) scale(0.9)"

          setTimeout(() => {
            confirmDialog.remove()
            transcript.style.transition = "opacity 0.3s ease"
            transcript.style.opacity = "0.5"
            setTimeout(() => {
              transcript.value = ""
              updateCharCount()
              transcript.style.opacity = "1"
              showToast("Transcript cleared")
            }, 300)
          }, 300)
        })
        document.getElementById("cancel-clear").addEventListener("click", () => {
          confirmDialog.style.opacity = "0"
          confirmDialog.style.transform = "translate(-50%, 50%) scale(0.9)"
          setTimeout(() => confirmDialog.remove(), 300)
        })
      }
    })
  }
  if (saveButton) {
    saveButton.addEventListener("click", () => saveIdea())
  }

  if (refreshIdeasButton) {
    refreshIdeasButton.addEventListener("click", () => {
      refreshIdeasButton.style.transition = "transform 0.5s ease"
      refreshIdeasButton.style.transform = "rotate(360deg)"

      setTimeout(() => {
        refreshIdeasButton.style.transform = "rotate(0deg)"
        loadIdeas()
        showToast("Ideas list refreshed")
      }, 500)
    })
  }
  // توليد خريطة ذهنية للفكرة
  if (mindMapTextBtn) {
    mindMapTextBtn.addEventListener("click", async () => {
      const ideaText = transcript.value.trim()
      if (!ideaText) {
        showToast("No idea to visualize.", "error")
        return
      }
      mindMapTextBtn.disabled = true
      mindMapTextBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Generating...'
      if (window.lucide) {
        window.lucide.createIcons()
      }
      mindMapTextOutput.style.display = "block"
      mindMapTextOutput.style.opacity = "0"
      mindMapTextOutput.style.transform = "translateY(10px)"
      mindMapTextOutput.innerHTML =
        '<div style="text-align: center; padding: 1rem;"><i data-lucide="loader-2" class="animate-spin"></i> Creating your mind map...</div>'
      if (window.lucide) {
        window.lucide.createIcons()
      }

      setTimeout(() => {
        mindMapTextOutput.style.transition = "opacity 0.5s ease, transform 0.5s ease"
        mindMapTextOutput.style.opacity = "1"
        mindMapTextOutput.style.transform = "translateY(0)"
      }, 10)

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer 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`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "Convert the following idea into a clean, clear Markdown-based mind map. Use # for title, - for nodes, and indent children appropriately.",
              },
              {
                role: "user",
                content: `Create a mind map based on this idea:\n\n${ideaText}`,
              },
            ],
          }),
        })

        const data = await res.json()
        const markdown = data.choices?.[0]?.message?.content
        if (!markdown) throw new Error("No map returned")
        mindMapTextOutput.style.opacity = "0"
        setTimeout(() => {
          mindMapTextOutput.textContent = markdown
          mindMapTextOutput.style.opacity = "1"
        }, 300)

        showToast("Mind map generated successfully!", "success")
      } catch (err) {
        console.error(err)
        mindMapTextOutput.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 1rem;">
          <i data-lucide="alert-triangle"></i> 
          <p>Failed to generate mind map.</p>
          <button class="secondary-button" style="margin-top: 0.5rem;" onclick="document.getElementById('mindMapTextBtn').click()">
            Try Again
          </button>
        </div>`
        if (window.lucide) {
          window.lucide.createIcons()
        }
        showToast("Failed to generate map text", "error")
      } finally {
        mindMapTextBtn.disabled = false
        mindMapTextBtn.innerHTML = '<i data-lucide="git-branch"></i> Generate Mind Map'
        if (window.lucide) {
          window.lucide.createIcons()
        }
      }
    })
  }
   // إرسال الفكرة للمساعد الذكي
  if (sendToAIButton) {
    sendToAIButton.addEventListener("click", () => {
      const message = transcript.value.trim()
      if (!message) {
        showToast("No idea to send.", "error")
        return
      }
      chatbotContainer.classList.remove("hidden")
      chatbotContainer.style.opacity = "0"
      chatbotContainer.style.transform = "scale(0.9)"

      setTimeout(() => {
        chatbotContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease"
        chatbotContainer.style.opacity = "1"
        chatbotContainer.style.transform = "scale(1)"
        chatbotIcon.style.display = "none"
      }, 10)
      appendMessage("user", message)
      const reviewPrompt = `Can you review this idea and suggest how to improve it to be more effective and actionable?\n\n${message}`
      getBotResponse(reviewPrompt)
      showToast("Idea sent to AI")
    })
  }

  if (chatbotIcon) {
    chatbotIcon.addEventListener("click", () => {
      chatbotContainer.classList.remove("hidden")
      chatbotContainer.style.opacity = "0"
      chatbotContainer.style.transform = "scale(0.9)"

      setTimeout(() => {
        chatbotContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease"
        chatbotContainer.style.opacity = "1"
        chatbotContainer.style.transform = "scale(1)"
        chatbotIcon.style.display = "none"
      }, 10)
    })
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      chatbotContainer.style.opacity = "0"
      chatbotContainer.style.transform = "scale(0.9)"

      setTimeout(() => {
        chatbotContainer.classList.add("hidden")
        chatbotIcon.style.display = "flex"
      }, 300)
    })
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage)
  }

  if (chatbotInput) {
    chatbotInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage()
      }
    })
  }

  function sendMessage() {
    const userMessage = chatbotInput.value.trim()
    if (userMessage) {
      appendMessage("user", userMessage)
      chatbotInput.value = ""
      getBotResponse(userMessage)
    }
  }

  function appendMessage(sender, message) {
    const messageElement = document.createElement("div")
    messageElement.classList.add("message", sender)
    messageElement.textContent = message
    messageElement.style.opacity = "0"
    messageElement.style.transform = sender === "user" ? "translateX(20px)" : "translateX(-20px)"
    chatbotMessages.appendChild(messageElement)
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight

    setTimeout(() => {
      messageElement.style.transition = "opacity 0.3s ease, transform 0.3s ease"
      messageElement.style.opacity = "1"
      messageElement.style.transform = "translateX(0)"
    }, 10)
  }

  let chatHistory = [
    {
      role: "system",
      content: `
        You are a creative idea assistant.
        Your ONLY job is to help the user brainstorm, expand, refine, or develop their IDEAS only.
        Do not change the topic or start small talk. Always stay focused on the user's idea.
        If the idea is unclear, ask relevant questions to clarify it before continuing.
      `.trim(),
    },
  ]
 // دالة بتجيب رد من الشات بوت
  async function getBotResponse(userMessage) {
    chatHistory.push({ role: "user", content: userMessage })
    const typingIndicator = document.createElement("div")
    typingIndicator.className = "message bot"
    typingIndicator.id = "typing-indicator"
    typingIndicator.innerHTML = `
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; animation: pulse 1s infinite;"></div>
        <div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; animation: pulse 1s infinite 0.2s;"></div>
        <div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; animation: pulse 1s infinite 0.4s;"></div>
      </div>
    `
    chatbotMessages.appendChild(typingIndicator)
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight

    try {
      const apiKey =
        "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"
      const apiUrl = "https://api.openai.com/v1/chat/completions"

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: chatHistory,
          max_tokens: 500,
        }),
      })

      const data = await response.json()
      const botMessage = data.choices[0].message.content
      chatHistory.push({ role: "assistant", content: botMessage })

      document.getElementById("typing-indicator").remove()
      appendMessage("bot", botMessage)
    } catch (error) {
      console.error("Error fetching bot response:", error)
      document.getElementById("typing-indicator").remove()
      appendMessage("bot", "Sorry, something went wrong. Please try again.")
    }
  }
  // نبدأ النظام بالتعرف على الصوت ونحدث العداد
  initializeSpeechRecognition()
  transcript.addEventListener("input", updateCharCount)
  updateCharCount()
  const resetChatBtn = document.getElementById("reset-btn")
  if (resetChatBtn) {
    resetChatBtn.addEventListener("click", () => {
      const confirmDialog = document.createElement("div")
      confirmDialog.className = "toast"
      confirmDialog.style.animation = "none"
      confirmDialog.style.bottom = "50%"
      confirmDialog.style.transform = "translate(-50%, 50%)"
      confirmDialog.style.padding = "1.5rem"
      confirmDialog.style.width = "300px"
      confirmDialog.style.textAlign = "center"
      confirmDialog.innerHTML = `
        <div style="margin-bottom: 1rem;">Are you sure you want to reset the conversation?</div>
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button id="confirm-reset" class="primary-button" style="background: var(--danger); padding: 0.5rem 1rem;">Reset</button>
          <button id="cancel-reset" class="secondary-button" style="padding: 0.5rem 1rem;">Cancel</button>
        </div>
      `
      document.body.appendChild(confirmDialog)
      setTimeout(() => {
        confirmDialog.style.transition = "opacity 0.3s ease, transform 0.3s ease"
        confirmDialog.style.opacity = "1"
        confirmDialog.style.transform = "translate(-50%, 50%) scale(1)"
      }, 10)

      document.getElementById("confirm-reset").addEventListener("click", () => {
        confirmDialog.style.opacity = "0"
        confirmDialog.style.transform = "translate(-50%, 50%) scale(0.9)"

        setTimeout(() => {
          confirmDialog.remove()

          chatbotMessages.style.transition = "opacity 0.3s ease"
          chatbotMessages.style.opacity = "0"

          setTimeout(() => {
            chatbotMessages.innerHTML = ""
            chatHistory = [
              {
                role: "system",
                content: `
                  You are a creative idea assistant.
                  Your ONLY job is to help the user brainstorm, expand, refine, or develop their IDEAS only.
                  Do not change the topic or start small talk. Always stay focused on the user's idea.
                  If the idea is unclear, ask relevant questions to clarify it before continuing.
                `.trim(),
              },
            ]
            const welcomeMessage = document.createElement("div")
            welcomeMessage.className = "message bot"
            welcomeMessage.textContent =
              "Hi there! I'm your AI idea assistant. Share your ideas with me, and I'll help you refine and develop them."
            chatbotMessages.appendChild(welcomeMessage)

            chatbotMessages.style.opacity = "1"
            showToast("Chat reset")
          }, 300)
        }, 300)
      })

      document.getElementById("cancel-reset").addEventListener("click", () => {
        confirmDialog.style.opacity = "0"
        confirmDialog.style.transform = "translate(-50%, 50%) scale(0.9)"
        setTimeout(() => confirmDialog.remove(), 300)
      })
    })
  }
  setTimeout(() => {
    const welcomeSection = document.querySelector(".app-welcome")
    if (welcomeSection) {
      welcomeSection.style.animation = "fadeIn 0.8s ease-out"
    }
    const featureItems = document.querySelectorAll(".feature-item")
    featureItems.forEach((item, index) => {
      item.style.animationDelay = `${0.1 + index * 0.1}s`
    })
  }, 500)
})
document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("username")
  const welcomeEl = document.getElementById("welcomeMessage")

  if (username && welcomeEl) {
    welcomeEl.textContent = `Welcome, ${username}!`

    setTimeout(() => {
      localStorage.removeItem("username")
    }, 3000)
  }
})
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar")
  const sidebarToggle = document.getElementById("sidebar-toggle")
  const sidebarOverlay = document.getElementById("sidebar-overlay")

  function toggleSidebar() {
    sidebar.classList.toggle("open")
    sidebarOverlay.classList.toggle("open")
  }

  sidebarToggle.addEventListener("click", toggleSidebar)
  sidebarOverlay.addEventListener("click", toggleSidebar)
  const tabButtons = document.querySelectorAll(".tab-button")
  const tabContents = document.querySelectorAll(".tab-content")
  // التنقل بين التبويبات (تسجيل، أفكاري...)
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab

      tabButtons.forEach((btn) => btn.classList.remove("active"))
      button.classList.add("active")

      tabContents.forEach((tab) => tab.classList.remove("active"))

      if (tabName) {
        document.getElementById(`${tabName}-tab`).classList.add("active")
      }
    })
  })

  const logoutButtonSidebar = document.getElementById("logoutButtonSidebar")
  const logoutButton = document.getElementById("logoutButton")

  if (logoutButtonSidebar && logoutButton) {
    logoutButtonSidebar.addEventListener("click", () => {
      logoutButton.click()
    })
  }
})
