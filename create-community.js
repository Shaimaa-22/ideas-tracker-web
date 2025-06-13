//  استيراد إعدادات Firebase
import { db, auth } from "./firebase-config.js"
import {
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
//  تحديد الفورم من الصفحة
const form = document.getElementById("createCommunityForm")
// التأكد إذا المستخدم مسجل دخول أولًا
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("You must be logged in to create a community.")
    window.location.href = "login.html"
    return
  }
  //  لما المستخدم يضغط على زر الإرسال (إنشاء مجتمع)
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    //  أخذ القيم من المدخلات
    const name = document.getElementById("name").value.trim()
    const description = document.getElementById("description").value.trim()
    const isPrivate = document.getElementById("isPrivate").value === "true"

    try {
   // إنشاء المجتمع داخل كولكشن "communities"

      const docRef = await addDoc(collection(db, "communities"), {
        name,
        description,
        isPrivate,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      //  نضيف المستخدم كعضو تلقائي مع صلاحيات أدمن
      await setDoc(doc(db, "communities", docRef.id, "members", user.uid), {
  uid: user.uid,  
  joinedAt: serverTimestamp(),
  isApproved: true,
  canPost: true,
  isAdmin: true   
})
      // إشعار و إعادة توجيه لصفحة المجتمعات

      alert("Community created successfully.")
      window.location.href = "communities.html"
    } catch (err) {
      console.error("Error creating community:", err.message)
      alert("Failed to create community. Please try again.")
    }
  })
})
