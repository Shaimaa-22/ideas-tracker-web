// هون عم نستورد الأشياء الأساسية من ملف firebase-config.js
import { auth } from "./firebase-config.js"
import { db } from "./firebase-config.js"

// هاي الدوال من Firebase عشان نستخدمها لتسجيل حساب جديد أو تسجيل الدخول
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

// هاي دوال من Firestore عشان نحفظ بيانات المستخدم
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

// هون بنمسك العناصر من الصفحة عشان نتعامل معاها
const emailInput = document.getElementById("email")
const passwordInput = document.getElementById("password")
const nameInput = document.getElementById("username")
const authButton = document.getElementById("authButton")
const toggleText = document.getElementById("toggleText")
const formTitle = document.getElementById("form-title")
const nameGroup = document.getElementById("name-group")
const themeToggle = document.getElementById("themeToggle")

const toast = document.getElementById("toast")

let isLogin = true   // متغير بنحدد فيه إذا الوضع الحالي هو تسجيل دخول أو تسجيل حساب

// ✅ دالة بتعرض رسالة على الشاشة لفترة قصيرة
function showToast(message, type = "success") {
  toast.textContent = message
  toast.className = `toast ${type}`
  toast.style.display = "block"

  setTimeout(() => {
    toast.style.display = "none"
  }, 3000)
}

async function handleAuth(event) {
  event.preventDefault() // يمنع الريلود

  const email = emailInput.value.trim()
  const password = passwordInput.value.trim()
  const name = nameInput.value.trim()

  if (!email || !password) {
    showToast("Please enter email and password", "error")
    return
  }

  if (!isLogin && !name) {
    showToast("Please enter your name", "error")
    return
  }

  try {
      // إذا المستخدم بدو يسجل دخول
    if (isLogin) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      localStorage.setItem("uid", userCredential.user.uid)
      showToast("Login successful", "success")
      window.location.href = "index.html"
    } else {
          // أما إذا المستخدم بدو يسجل حساب جديد
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const userId = userCredential.user.uid

      await setDoc(doc(db, "users", userId), {
        email: email,
        name: name,
        createdAt: new Date().toISOString(),
      })// بنسجل معلومات المستخدم بقاعدة البيانات

      localStorage.setItem("uid", userId)
      localStorage.setItem("username", name) // 👈 ترحيب مؤقت
      showToast(`Welcome to IdeasTracker, ${name}!`, "success")

      // يدخل التطبيق مباشرة بعد ثواني قليلة
      setTimeout(() => {
        window.location.href = "index.html"
      }, 1000)
    }
  } catch (error) {
    showToast(error.message, "error")
  }
}

// ✅ Toggle Login/Register
function updateFormState() {
  formTitle.textContent = isLogin ? "Login to Your Account" : "Create Your Account"
  authButton.innerHTML = isLogin
    ? '<i data-lucide="log-in"></i><span>Login</span>'
    : '<i data-lucide="user-plus"></i><span>Register</span>'
  toggleText.textContent = isLogin ? "Register" : "Login"
  nameGroup.style.display = isLogin ? "none" : "block"
  lucide.createIcons()
}

// تبديل الوضع (فاتح/غامق)
function initializeTheme() {
  const savedTheme = localStorage.getItem("theme")
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add("dark")
    themeToggle.innerHTML = '<i data-lucide="sun"></i>'
  }

  themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark")
    const isDark = document.documentElement.classList.contains("dark")
    localStorage.setItem("theme", isDark ? "dark" : "light")
    themeToggle.innerHTML = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>'
    lucide.createIcons()
  })
}
document.getElementById("loginForm").addEventListener("submit", handleAuth)
authButton.addEventListener("click", handleAuth)
toggleText.addEventListener("click", () => {
  isLogin = !isLogin
  updateFormState()
})

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons()
  initializeTheme()
  updateFormState()
})
