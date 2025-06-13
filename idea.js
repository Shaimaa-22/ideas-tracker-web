// استيراد Firebase والوظائف من فايرستور والمصادقة
import { db, auth } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// إعدادات Cloudinary لرفع الملفات
const cloudinaryConfig = {
  cloudName: 'dqmml8g4q',
  uploadPreset: 'ml_default',
  resourceType: 'auto',
  clientAllowedFormats: ['jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  maxFileSize: 5000000 
};

// العناصر من صفحة HTML
const topicInput = document.getElementById("ideaTopic");
const contentTextarea = document.getElementById("ideaContent");
const editBtn = document.getElementById("editBtn");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveControls = document.getElementById("saveControls");
const communitySelect = document.getElementById("communitySelect");
const publishBtn = document.getElementById("publishBtn");
const previewBtn = document.getElementById("previewBtn");
const closeEditBtn = document.getElementById("closeEditBtn");
const addFileBtn = document.getElementById("addFileBtn");
const fileInput = document.getElementById("fileInput");
const attachmentsContainer = document.getElementById("attachmentsContainer");
const publishPreviewContainer = document.getElementById("publishPreviewContainer");
const previewTitle = document.getElementById("previewTitle");
const previewContent = document.getElementById("previewContent");
const previewAttachments = document.getElementById("previewAttachments");

// عناصر الذكاء الاصطناعي
const sendToAIButton = document.getElementById("sendToAIButton");
const mindMapTextBtn = document.getElementById("mindMapTextBtn");
const mindMapTextOutput = document.getElementById("mindmap-text-output");
const chatbotContainer = document.getElementById("chatbot-container");
const chatbotIcon = document.getElementById("chatbot-icon");
const closeBtn = document.getElementById("close-btn");
const sendBtn = document.getElementById("send-btn");
const chatbotInput = document.getElementById("chatbot-input");
const chatbotMessages = document.getElementById("chatbot-messages");

// المتغيرات العامة
let ideaRef;
let currentUser;
let originalData = {
  topic: "",
  content: "", 
  attachments: [],
  imageUrl: null
};
let uploadedFiles = [];
let existingAttachments = [];
let isSaving = false;
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
];

const lucide = window.lucide || {
  createIcons: () => console.warn("Lucide library not loaded yet")
};

const urlParams = new URLSearchParams(window.location.search);
const ideaId = urlParams.get("id");

// دالة عرض الرسائل
function showToast(message, type = "success") {
  const existingToasts = document.querySelectorAll(".toast");
  existingToasts.forEach(toast => {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  });

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === "success" ? "check-circle" : type === "error" ? "alert-circle" : "info"}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  lucide.createIcons();

  toast.style.animation = "slideUp 0.3s ease";
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// الدوال المساعدة
function validateFile(file) {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const maxSize = 5 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      message: "File type not allowed. Allowed: images, PDF, Word" 
    };
  }

  if (file.size > maxSize) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    return { 
      valid: false, 
      message: `File size ${sizeInMB}MB exceeds limit (5MB)` 
    };
  }

  return { valid: true };
}

function getFileType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.includes('pdf')) return 'pdf';
  if (file.type.includes('word') || file.name.endsWith('.docx')) return 'word';
  return 'file';
}

function formatContent(content) {
  if (!content) return "";
  return content.split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}
//  رفع ملف إلى Cloudinary
async function uploadFilesToCloudinary(files) {
  const uploadedFiles = [];
  showToast("Uploading files...", "info");

  for (const file of files) {
    try {
      const validation = validateFile(file);
      if (!validation.valid) {
        showToast(`Skipped ${file.name}: ${validation.message}`, "error");
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      formData.append('cloud_name', cloudinaryConfig.cloudName);
      
      const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
      formData.append('resource_type', resourceType);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      
      uploadedFiles.push({
        url: data.secure_url,
        name: file.name,
        type: getFileType(file),
        size: data.bytes,
        public_id: data.public_id
      });

      showToast(`${file.name} uploaded`, "success");
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      showToast(`Failed to upload ${file.name}`, "error");
      
      uploadedFiles.push({
        url: URL.createObjectURL(file),
        name: file.name,
        type: getFileType(file),
        size: file.size,
        isTemporary: true
      });
    }
  }

  return uploadedFiles;
}
//  عرض المرفقات كم روابط أو صور
function renderAttachments(attachments) {
  attachmentsContainer.innerHTML = "";
  
  const renderAttachment = (attachment, index, isExisting = true) => {
    const item = document.createElement("div");
    item.className = "attachment-item";

    const iconName = attachment.type === "image" ? "image" : 
                    attachment.type === "pdf" ? "file-text" : 
                    attachment.type === "word" ? "file-text" : "file";

    if (attachment.type === "image") {
      item.innerHTML = `
        <img src="${attachment.url}" class="attachment-preview" alt="${attachment.name}">
        <div class="attachment-info">
          <div>${attachment.name}</div>
          <small>${(attachment.size / 1024).toFixed(2)} KB • ${attachment.type}</small>
        </div>
      `;
    } else {
      item.innerHTML = `
        <i data-lucide="${iconName}" width="50" height="50" class="attachment-preview"></i>
        <div class="attachment-info">
          <div>${attachment.name}</div>
          <small>${(attachment.size / 1024).toFixed(2)} KB • ${attachment.type}</small>
        </div>
      `;
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "attachment-remove";
    removeBtn.dataset.index = index;
    removeBtn.dataset.existing = isExisting;
    removeBtn.innerHTML = '<i data-lucide="trash-2"></i>';
    item.appendChild(removeBtn);

    attachmentsContainer.appendChild(item);
  };

  existingAttachments.forEach((attachment, index) => renderAttachment(attachment, index, true));
  uploadedFiles.forEach((file, index) => {
    const attachmentType = getFileType(file);
    renderAttachment({
      url: URL.createObjectURL(file),
      name: file.name,
      type: attachmentType,
      size: file.size
    }, index, false);
  });

  lucide.createIcons();
}

// جلب الفكرة من Firestore حسب ID في الرابط
async function loadIdea() {
  try {
    const snapshot = await getDoc(ideaRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      originalData = {
        topic: data.topic || "",
        content: data.content || "",
        attachments: data.attachments || [],
        imageUrl: data.imageUrl || null
      };

      existingAttachments = originalData.attachments;
      topicInput.value = originalData.topic;
      contentTextarea.value = originalData.content;
      document.getElementById("ideaTitle").textContent = originalData.topic || "Idea Details";

      if (originalData.imageUrl) {
        document.getElementById("ideaImage").src = originalData.imageUrl;
        document.getElementById("ideaImage").style.display = "block";
      }

      if (existingAttachments.length > 0) {
        renderAttachments(existingAttachments);
      }
    } else {
      showToast("Idea not found", "error");
    }
  } catch (error) {
    console.error("Error loading idea:", error);
    showToast("Failed to load idea", "error");
  }
}
//  تحميل المجتمعات المتاحة للنشر
async function loadUserCommunities() {
  try {
    communitySelect.innerHTML = '<option value="">-- Select Community --</option>';
    const communitiesRef = collection(db, "communities");
    const communitiesSnap = await getDocs(communitiesRef);
    
    let hasCommunities = false;
    for (const docSnap of communitiesSnap.docs) {
      const communityId = docSnap.id;
      const memberRef = doc(db, `communities/${communityId}/members/${currentUser.uid}`);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists() && memberSnap.data().isApproved) {
        const option = document.createElement("option");
        option.value = communityId;
        option.textContent = docSnap.data().name;
        communitySelect.appendChild(option);
        hasCommunities = true;
      }
    }

    if (!hasCommunities) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "-- Join communities first --";
      option.disabled = true;
      communitySelect.innerHTML = "";
      communitySelect.appendChild(option);
      publishBtn.disabled = true;
      previewBtn.disabled = true;
    } else {
      publishBtn.disabled = false;
      previewBtn.disabled = false;
    }
  } catch (error) {
    console.error("Error loading communities:", error);
    showToast("Failed to load communities", "error");
  }
}

function generatePreview() {
  const topic = topicInput.value.trim();
  const content = contentTextarea.value.trim();

  if (!topic || !content) {
    showToast("Please add a topic and content first", "error");
    return false;
  }

  previewTitle.textContent = topic;
  previewContent.innerHTML = formatContent(content);
  previewAttachments.innerHTML = "";

  if (existingAttachments.length > 0 || uploadedFiles.length > 0) {
    const attachmentsGrid = document.createElement("div");
    attachmentsGrid.className = "preview-attachments-grid";

    const renderPreviewAttachment = (attachment) => {
      if (attachment.type === "image") {
        return `
          <div class="preview-image-container">
            <img src="${attachment.url}" alt="${attachment.name}" class="preview-image">
          </div>
        `;
      } else {
        const iconName = attachment.type === "pdf" ? "file-text" : 
                        attachment.type === "word" ? "file-text" : "file";
        return `
          <div class="preview-file-container">
            <i data-lucide="${iconName}"></i>
            <span>${attachment.name}</span>
          </div>
        `;
      }
    };

    existingAttachments.forEach(attachment => {
      attachmentsGrid.innerHTML += renderPreviewAttachment(attachment);
    });

    uploadedFiles.forEach(file => {
      attachmentsGrid.innerHTML += renderPreviewAttachment({
        url: URL.createObjectURL(file),
        name: file.name,
        type: getFileType(file)
      });
    });

    previewAttachments.appendChild(attachmentsGrid);
  }

  lucide.createIcons();
  publishPreviewContainer.style.display = "block";
  publishPreviewContainer.scrollIntoView({ behavior: "smooth" });

  return true;
}

async function publishIdea(communityId) {
  try {
    const memberRef = doc(db, `communities/${communityId}/members/${currentUser.uid}`);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      showToast("You are not a member of this community", "error");
      return false;
    }

    const memberData = memberSnap.data();
    if (!memberData.isApproved) {
      showToast("Your membership is pending approval", "error");
      return false;
    }

    if (memberData.canPost === false) {
      showToast("You don't have posting permission", "error");
      return false;
    }
    
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userName = userSnap.exists() ? userSnap.data().name || "Unknown" : "Unknown";

    showToast("Publishing your idea...", "info");

    let newAttachments = [];
    if (uploadedFiles.length > 0) {
      newAttachments = await uploadFilesToCloudinary(uploadedFiles);
    }

    const allAttachments = [...existingAttachments, ...newAttachments].filter(
      attachment => attachment && attachment.url && attachment.type
    );

    let mainImageUrl = allAttachments.find(a => a.type === "image")?.url || originalData.imageUrl || null;
    const ideaData = {
      title: topicInput.value.trim() || "Untitled Idea",
      content: contentTextarea.value.trim() || "",
      formattedContent: formatContent(contentTextarea.value.trim()) || "",
      createdBy: currentUser.uid,
      userId: currentUser.uid,
      authorName: userName,
      createdAt: serverTimestamp(),
      originalIdeaId: ideaId,
      attachments: allAttachments,
      ...(mainImageUrl && { imageUrl: mainImageUrl })
    };

    const communityIdeaRef = doc(db, `communities/${communityId}/ideas/${ideaId}`);
    await setDoc(communityIdeaRef, ideaData);

    return true;
  } catch (err) {
    console.error("Publish error:", err);
    showToast(`Publishing failed: ${err.message}`, "error");
    return false;
  }
}

async function saveIdea() {
  if (isSaving) return;
  
  const topic = topicInput.value.trim();
  const content = contentTextarea.value.trim();

  if (!topic || !content) {
    showToast("Please enter both topic and content", "error");
    return;
  }

  const confirmDialog = document.createElement("div");
  confirmDialog.className = "confirm-dialog";
  confirmDialog.innerHTML = `
    <div class="confirm-content">
      <h3><i data-lucide="alert-circle"></i> Save Changes</h3>
      <p>Are you sure you want to save these changes to your idea?</p>
      <div class="confirm-buttons">
        <button id="confirmSave" class="primary-button">
          <i data-lucide="check"></i> Yes, Save
        </button>
        <button id="cancelSave" class="secondary-button">
          <i data-lucide="x"></i> Cancel
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmDialog);
  lucide.createIcons();
// مراجعة الذكاء الاصطناعي للفكرة
  document.getElementById("confirmSave").addEventListener("click", async () => {
    confirmDialog.remove();
    isSaving = true;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Saving...';
    lucide.createIcons();

    try {
      const newAttachments = uploadedFiles.length > 0 
        ? await uploadFilesToCloudinary(uploadedFiles) 
        : [];

      const allAttachments = [...existingAttachments, ...newAttachments].filter(
        attachment => attachment && attachment.url && attachment.type
      );

      let mainImageUrl = allAttachments.find(a => a.type === "image")?.url || originalData.imageUrl || null;

      const updateData = {
        topic: topicInput.value.trim(),
        content: contentTextarea.value.trim(),
        attachments: allAttachments,
        updatedAt: serverTimestamp(),
        ...(mainImageUrl && { imageUrl: mainImageUrl })
      };

      await updateDoc(ideaRef, updateData);

      originalData = {
        topic: topicInput.value.trim(),
        content: contentTextarea.value.trim(),
        attachments: allAttachments,
        imageUrl: mainImageUrl
      };

      topicInput.disabled = true;
      contentTextarea.disabled = true;
      saveControls.style.display = "none";
      closeEditBtn.style.display = "none";
      addFileBtn.style.display = "none";
      uploadedFiles = [];

      saveBtn.innerHTML = '<i data-lucide="check"></i> Saved!';
      lucide.createIcons();

      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="save"></i> Save';
        lucide.createIcons();
        isSaving = false;
      }, 1000);

      showToast("Idea updated successfully!");
    } catch (err) {
      console.error("Update error:", err);
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="save"></i> Save';
      lucide.createIcons();
      isSaving = false;
      showToast("Failed to update idea", "error");
    }
  });

  document.getElementById("cancelSave").addEventListener("click", () => {
    confirmDialog.remove();
    showToast("Save canceled", "info");
  });
}

// توليد خريطة ذهنية باستخدام GPT
async function generateMindMap() {
  const ideaText = contentTextarea.value.trim();
  if (!ideaText) {
    showToast("No idea to visualize.", "error");
    return;
  }
  
  mindMapTextBtn.disabled = true;
  mindMapTextBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Generating...';
  lucide.createIcons();
  
  mindMapTextOutput.style.display = "block";
  mindMapTextOutput.style.opacity = "0";
  mindMapTextOutput.style.transform = "translateY(10px)";
  mindMapTextOutput.innerHTML = 
    '<div style="text-align: center; padding: 1rem;"><i data-lucide="loader-2" class="animate-spin"></i> Creating your mind map...</div>';
  lucide.createIcons();

  try {
    // استدعاء OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: "Convert the following idea into a clean, clear Markdown-based mind map. Use # for title, - for nodes, and indent children appropriately.",
          },
          {
            role: "user",
            content: `Create a mind map based on this idea:\n\n${ideaText}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const markdown = data.choices?.[0]?.message?.content;
    
    if (!markdown) throw new Error("No map returned");
    
    mindMapTextOutput.style.opacity = "0";
    setTimeout(() => {
      mindMapTextOutput.innerHTML = markdown;
      mindMapTextOutput.style.opacity = "1";
    }, 300);

    showToast("Mind map generated successfully!", "success");
  } catch (err) {
    console.error(err);
    mindMapTextOutput.innerHTML = `
      <div style="color: var(--danger); text-align: center; padding: 1rem;">
        <i data-lucide="alert-triangle"></i> 
        <p>Failed to generate mind map.</p>
        <button class="secondary-button" style="margin-top: 0.5rem;" onclick="generateMindMap()">
          Try Again
        </button>
      </div>`;
    lucide.createIcons();
    showToast("Failed to generate map text", "error");
  } finally {
    mindMapTextBtn.disabled = false;
    mindMapTextBtn.innerHTML = '<i data-lucide="git-branch"></i> Generate Mind Map';
    lucide.createIcons();
  }
}

function appendMessage(sender, message) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);
  messageElement.textContent = message;
  messageElement.style.opacity = "0";
  messageElement.style.transform = sender === "user" ? "translateX(20px)" : "translateX(-20px)";
  chatbotMessages.appendChild(messageElement);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

  setTimeout(() => {
    messageElement.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    messageElement.style.opacity = "1";
    messageElement.style.transform = "translateX(0)";
  }, 10);
}

async function getBotResponse(userMessage) {
  chatHistory.push({ role: "user", content: userMessage });
  
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "message bot";
  typingIndicator.id = "typing-indicator";
  typingIndicator.innerHTML = `
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; animation: pulse 1s infinite;"></div>
      <div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; animation: pulse 1s infinite 0.2s;"></div>
      <div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; animation: pulse 1s infinite 0.4s;"></div>
    </div>
  `;
  chatbotMessages.appendChild(typingIndicator);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer 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`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: chatHistory,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const botMessage = data.choices[0].message.content;
    chatHistory.push({ role: "assistant", content: botMessage });

    document.getElementById("typing-indicator").remove();
    appendMessage("bot", botMessage);
  } catch (error) {
    console.error("Error fetching bot response:", error);
    document.getElementById("typing-indicator").remove();
    appendMessage("bot", "Sorry, something went wrong. Please try again.");
  }
}

function sendMessage() {
  const userMessage = chatbotInput.value.trim();
  if (userMessage) {
    appendMessage("user", userMessage);
    chatbotInput.value = "";
    getBotResponse(userMessage);
  }
}

// نظام الثيمات
let selectedTheme = null;
let currentTheme = localStorage.getItem('color-theme') || 'blue';

function setupThemeSystem() {
  const themeOptions = document.querySelectorAll('.theme-option');
  const savedTheme = localStorage.getItem('color-theme') || 'blue';
  
  // تطبيق الثيم المحفوظ عند التحميل
  applyTheme(savedTheme);
  setActiveTheme(savedTheme);

  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      applyTheme(theme);
      setActiveTheme(theme);
      saveTheme(theme);
    });
  });

  function applyTheme(theme) {
    document.documentElement.className = `theme-${theme}`;
  }

  function setActiveTheme(theme) {
    themeOptions.forEach(opt => {
      opt.classList.remove('active');
      if(opt.dataset.theme === theme) {
        opt.classList.add('active');
      }
    });
  }

  function saveTheme(theme) {
    localStorage.setItem('color-theme', theme);
  }
}

// إعداد مستمعات الأحداث
function setupEventListeners() {
  editBtn.addEventListener("click", () => {
    topicInput.disabled = false;
    contentTextarea.disabled = false;
    saveControls.style.display = "flex";
    closeEditBtn.style.display = "block";
    addFileBtn.style.display = "block";
    topicInput.focus();
  });

  closeEditBtn.addEventListener("click", () => {
    topicInput.value = originalData.topic;
    contentTextarea.value = originalData.content;
    topicInput.disabled = true;
    contentTextarea.disabled = true;
    saveControls.style.display = "none";
    closeEditBtn.style.display = "none";
    addFileBtn.style.display = "none";
    uploadedFiles = [];
    renderAttachments(existingAttachments);
    showToast("Changes discarded", "info");
  });

  addFileBtn.addEventListener("click", () => fileInput.click());
//  رفع مرفقات إلى Cloudinary وعرضها
  fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      uploadedFiles = [...uploadedFiles, ...files];
      renderAttachments();
      fileInput.value = "";
      showToast(`${files.length} file(s) added`, "success");
    }
  });

  attachmentsContainer.addEventListener("click", (e) => {
    if (e.target.closest(".attachment-remove")) {
      const button = e.target.closest(".attachment-remove");
      const index = Number(button.dataset.index);
      const isExisting = button.dataset.existing === "true";

      if (isExisting) {
        existingAttachments.splice(index, 1);
      } else {
        uploadedFiles.splice(index, 1);
      }
      renderAttachments();
      showToast("Attachment removed", "info");
    }
  });

  saveBtn.addEventListener("click", saveIdea);

  cancelBtn.addEventListener("click", () => {
    topicInput.value = originalData.topic;
    contentTextarea.value = originalData.content;
    topicInput.disabled = true;
    contentTextarea.disabled = true;
    saveControls.style.display = "none";
    closeEditBtn.style.display = "none";
    addFileBtn.style.display = "none";
    uploadedFiles = [];
    renderAttachments(existingAttachments);
    showToast("Changes discarded", "info");
  });

  previewBtn.addEventListener("click", () => {
    if (!communitySelect.value) {
      showToast("Please select a community first", "error");
      communitySelect.focus();
      return;
    }
    generatePreview();
  });
//  نشر الفكرة إلى مجتمع معين
  publishBtn.addEventListener("click", async () => {
    const communityId = communitySelect.value;
    if (!communityId) {
      showToast("Please select a community first", "error");
      communitySelect.focus();
      return;
    }

    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Publishing...';
    lucide.createIcons();

    const success = await publishIdea(communityId);
//  إشعار بسيط
    if (success) {
      publishBtn.innerHTML = '<i data-lucide="check"></i> Published!';
      lucide.createIcons();
      showToast("Idea published successfully! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = `community.html?id=${communityId}`;
      }, 2000);
    } else {
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<i data-lucide="send"></i> Publish';
      lucide.createIcons();
    }
  });

  communitySelect.addEventListener("change", () => {
    if (communitySelect.value) {
      publishPreviewContainer.style.display = "none";
    }
  });

  // مستمعات أحداث الذكاء الاصطناعي
  if (mindMapTextBtn) {
    mindMapTextBtn.addEventListener("click", generateMindMap);
  }

  if (sendToAIButton) {
    sendToAIButton.addEventListener("click", () => {
      const message = contentTextarea.value.trim();
      if (!message) {
        showToast("No idea to send.", "error");
        return;
      }
      
      chatbotContainer.classList.remove("hidden");
      chatbotContainer.style.opacity = "0";
      chatbotContainer.style.transform = "scale(0.9)";

      setTimeout(() => {
        chatbotContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        chatbotContainer.style.opacity = "1";
        chatbotContainer.style.transform = "scale(1)";
        chatbotIcon.style.display = "none";
      }, 10);
      
      appendMessage("user", message);
      const reviewPrompt = `Can you review this idea and suggest how to improve it to be more effective and actionable?\n\n${message}`;
      getBotResponse(reviewPrompt);
      showToast("Idea sent to AI");
    });
  }

  if (chatbotIcon) {
    chatbotIcon.addEventListener("click", () => {
      chatbotContainer.classList.remove("hidden");
      chatbotContainer.style.opacity = "0";
      chatbotContainer.style.transform = "scale(0.9)";

      setTimeout(() => {
        chatbotContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        chatbotContainer.style.opacity = "1";
        chatbotContainer.style.transform = "scale(1)";
        chatbotIcon.style.display = "none";
      }, 10);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      chatbotContainer.style.opacity = "0";
      chatbotContainer.style.transform = "scale(0.9)";

      setTimeout(() => {
        chatbotContainer.classList.add("hidden");
        chatbotIcon.style.display = "flex";
      }, 300);
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (chatbotInput) {
    chatbotInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });
  }
}

// ✅ التأكد من أن المستخدم مسجّل دخول
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  ideaRef = doc(db, `users/${user.uid}/ideas/${ideaId}`);

  document.getElementById("ideaTitle").innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Loading...';
  lucide.createIcons();

  setupThemeSystem(); 
  await loadIdea();
  await loadUserCommunities();
  setupEventListeners();

  const style = document.createElement("style");
  //  تعريف التنسيقات الخاصة بمعاينة نشر الفكرة والمرفقات وغيرها
  style.textContent = `
    /* كرت المعاينة الكامل */
    .publish-preview {
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: var(--shadow);
      transition: all 0.3s ease;
    }
      /*  نص محتوى الفكرة داخل المعاينة */
    .preview-content {
      margin-bottom: 1.5rem;
    }
    
    .preview-content p {
      margin-bottom: 1rem;
      line-height: 1.6;
    }
      /*  شبكة عرض المرفقات */
    .preview-attachments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
      /* تنسيق صورة داخل كرت المرفق */
    .preview-image-container {
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    
    .preview-image {
      width: 100%;
      height: 150px;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    
    .preview-image:hover {
      transform: scale(1.05);
    }
      /* مرفق غير صورة (ملف Word / PDF...) */
    .preview-file-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background-color: var(--input);
      border-radius: var(--radius);
      gap: 0.5rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .preview-file-container:hover {
      background-color: var(--primary-light);
    }
    
    .preview-file-container small {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }
      /*  مؤشر تحميل */
    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem;
      color: var(--primary);
    }
      /*  عرض كل مرفق بسطر منفصل */
    .attachment-item {
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background-color: var(--input);
      border-radius: var(--radius);
      margin-bottom: 0.5rem;
    }
      /*  صورة مصغرة للمرفق */
    .attachment-preview {
      width: 50px;
      height: 50px;
      object-fit: cover;
      border-radius: var(--radius);
    }
      /* معلومات المرفق */
    .attachment-info {
      flex: 1;
      min-width: 0;
    }
      /*  زر إزالة المرفق */
    .attachment-remove {
      background: none;
      border: none;
      color: var(--error);
      cursor: pointer;
    }
      /* شارة نوع الملف */
    .file-type-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 0.5rem;
      font-size: 0.7rem;
      margin-left: 0.5rem;
      background-color: var(--primary-light);
      color: var(--primary);
    }
      /*  شارات حسب نوع الملف */
    .pdf-badge {
      background-color: #ffebee;
      color: #f44336;
    }
    
    .word-badge {
      background-color: #e3f2fd;
      color: #2196f3;
    }
    
    .image-badge {
      background-color: #e8f5e9;
      color: #4caf50;
    }
  `
  // إضافة التنسيقات إلى <head>
  document.head.appendChild(style)
})