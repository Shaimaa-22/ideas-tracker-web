// استيراد إعدادات Firebase (قاعدة البيانات والمصادقة)
import { db } from "./firebase-config.js"
import { auth } from "./firebase-config.js"
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
//  حفظ المستخدم الحالي بعد تسجيل الدخول
let currentUser = null
onAuthStateChanged(auth, (user) => {
  currentUser = user
})
//  تصنيف الفكرة باستخدام GPT حسب محتواها لموضوع عام (مثل: مشروع، هدف...)
async function getIdeaTopic(ideaText) {
  const apiKey =
    "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" // ← ضيف مفتاح OpenAI هون

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Your job is to assign a broad topic to any idea. Respond ONLY with one or two words. Examples: Project, Learning, Goal, Self, Social, Creativity.",
        },
        {
          role: "user",
          content: `Idea: ${ideaText}`,
        },
      ],
    }),
  })

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || "Uncategorized"
}
// حفظ فكرة في Firestore للمستخدم الحالي مع تصنيفها ورفع صورة اختيارية
export async function saveIdeaToFirestore(content, language, imageFile = null) {
  if (!currentUser) {
    console.error("User not authenticated")
    return
  }

  try {
    let imageId = null
        //إذا تم رفع صورة، نقوم برفعها إلى Cloudinary
    if (imageFile && imageFile.size > 0) {
      imageId = await uploadImageToCloudinary(imageFile)
      if (!imageId) {
        console.error("Image upload failed")
        return
      }
    }
    const topic = await getIdeaTopic(content)// الحصول على موضوع الفكرة باستخدام GPT
    const idea = {
      content,
      language,
      topic,
      timestamp: new Date().toISOString(),
      isProcessed: false,
      imageId,
    }
    await addDoc(collection(db, `users/${currentUser.uid}/ideas`), idea)
    console.log("✅ Idea saved with topic:", topic)
  } catch (error) {
    console.error("❌ Error saving idea:", error)
  }
}
// تحميل جميع الأفكار الخاصة بالمستخدم وترتيبهم من الأحدث إلى الأقدم
export async function loadIdeasFromFirestore() {
  if (!currentUser) return []

  try {
    const q = query(collection(db, `users/${currentUser.uid}/ideas`), orderBy("timestamp", "desc"))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => {
      const idea = doc.data()
      const imageUrl = idea.imageId ? `https://res.cloudinary.com/dqmml8g4q/image/upload/${idea.imageId}` : null
      return {
        id: doc.id,
        ...idea,
        imageUrl, //  رابط مباشر للصورة إن وُجدت 
      }
    })
  } catch (error) {
    console.error("Error loading ideas:", error)
    return []
  }
}
// حذف فكرة واحدة من Firestore حسب معرفها
export async function deleteIdeaFromFirestore(id) {
  if (!currentUser) return

  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/ideas/${id}`))
    console.log("Idea deleted successfully from Firestore!")
  } catch (error) {
    console.error("Error deleting idea:", error)
  }
}
async function uploadImageToCloudinary(file) {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "ml_default") 
  formData.append("cloud_name", "dqmml8g4q") //← اسم الحساب في Cloudinary 

  try {
    const response = await fetch("https://api.cloudinary.com/v1_1/dqmml8g4q/image/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Failed to upload image")
    }

    const data = await response.json()
    if (data.secure_url) {
      console.log("Image uploaded successfully:", data.secure_url)
      return data.public_id // نرجع المعرف العام للصورة
    } else {
      throw new Error("Failed to get image URL from Cloudinary")
    }
  } catch (error) {
    console.error("Error uploading image:", error)
    alert("There was an issue uploading your image. Please try again.") // عرض رسالة للمستخدم
    return null
  }
}
