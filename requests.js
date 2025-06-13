// بنستورد الأشياء اللي بنحتاجها من firebase
import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// هون بنمسك العناصر من الصفحة عشان نقدر نحط فيها البيانات
const requestsContainer = document.getElementById("requestsContainer");
const communityNameEl = document.getElementById("communityName");
const membersContainer = document.getElementById("membersContainer");

// بنجيب ID تبع المجتمع من الرابط
const params = new URLSearchParams(window.location.search);
const selectedCommunityId = params.get("communityId");
let communityCreatorId = "";// رح نستخدمه نعرف إذا المستخدم هو المسؤول

// هاي بتتأكد إنه فيه وثيقة للمستخدم، وإذا ما فيه بتعمل وحدة
async function ensureUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "Unnamed User",
      email: user.email || "",
      createdAt: new Date(),
    });
    console.log("✅ User document created");
  }
}

// هاي بتجيب اسم المستخدم بناءً على الـ ID
async function getUserName(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data().name || "Unknown User" : "Unknown User";
  } catch (err) {
    console.warn("⚠️ Failed to fetch user name:", err);
    return "Unknown User";
  }
}

// هاي بتعرض طلب انضمام واحد
async function renderRequest(requestDoc, communityId) {
  const data = requestDoc.data();
  const container = document.createElement("div");
  container.className = "request-card";

  const userId = data.uid || data.userId;
  const userName = await getUserName(userId);

  const info = document.createElement("p");
  info.textContent = `${userName} requested to join.`;
  // زر الموافقة
  const approveBtn = document.createElement("button");
  approveBtn.textContent = "Approve";
  approveBtn.onclick = async () => {
    try {
      // بنضيفه كعضو
      const memberRef = doc(db, "communities", communityId, "members", userId);
      await setDoc(memberRef, {
        uid: userId,
        joinedAt: new Date(),
        addedBy: auth.currentUser.uid,
      });

      // بنغيّر حالة الطلب لـ approved
      await updateDoc(doc(db, "communities", communityId, "joinRequests", requestDoc.id), {
        status: "approved",
      });

      alert("✅ User approved and added.");
      container.remove();
    } catch (e) {
      console.error("❌ Error approving request:", e);
      alert("Failed to approve request: " + e.message);
    }
  };
  // زر الرفض

  const rejectBtn = document.createElement("button");
  rejectBtn.textContent = "Reject";
  rejectBtn.onclick = async () => {
    try {
      await updateDoc(doc(db, "communities", communityId, "joinRequests", requestDoc.id), {
        status: "rejected",
      });
      alert("Request rejected!");
      container.remove();
    } catch (e) {
      console.error("Error rejecting request:", e);
      alert("Failed to reject request: " + e.message);
    }
  };

  container.appendChild(info);
  container.appendChild(approveBtn);
  container.appendChild(rejectBtn);
  requestsContainer.appendChild(container);
}
// هاي بتعرض عضو واحد من المجتمع
async function renderMember(memberDoc, communityId, isLeader) {
  const data = memberDoc.data();
  const userId = data.uid || data.userId;

  const container = document.createElement("div");
  container.className = "member-card";

  const userName = await getUserName(userId);
  const info = document.createElement("p");
  info.textContent = `Member: ${userName}`;

  // إذا المستخدم هو المسؤول، بنعرض زر الحذف
  if (isLeader) {
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async () => {
      try {
        await deleteDoc(doc(db, "communities", communityId, "members", memberDoc.id));
        alert("Member removed!");
        container.remove();
      } catch (e) {
        console.error("Error removing member:", e);
        alert("Failed to remove member: " + e.message);
      }
    };
    container.appendChild(removeBtn);
  }

  container.appendChild(info);
  membersContainer.appendChild(container);
}

// هاي بتحمل بيانات المجتمع (الاسم وغيره)
async function loadCommunityData() {
  try {
    const communityRef = doc(db, "communities", selectedCommunityId);
    const communitySnap = await getDoc(communityRef);

    if (!communitySnap.exists()) {
      communityNameEl.textContent = "Community not found";
      return null;
    }

    const communityData = communitySnap.data();
    communityNameEl.textContent = communityData.name || "Unnamed Community";
    return communityData;
  } catch (err) {
    console.error("Error loading community data:", err);
    communityNameEl.textContent = "Error loading community";
    return null;
  }
}

// هاي بتحمل طلبات الانضمام وبتعرضهم
async function loadJoinRequests(userId, communityData) {
  try {
    if (!communityData.isPrivate) {
      requestsContainer.innerHTML = "<p>This community is public. No join requests available.</p>";
      return;
    }

    const joinRequestsRef = collection(db, "communities", selectedCommunityId, "joinRequests");
    const joinRequestsSnap = await getDocs(joinRequestsRef);

    let hasPending = false;

    joinRequestsSnap.forEach((requestDoc) => {
      const status = requestDoc.data().status;
      if (status === "pending") {
        hasPending = true;
        renderRequest(requestDoc, selectedCommunityId);
      }
    });

    // إذا ما فيه ولا طلب pending
    if (!hasPending) {
      requestsContainer.innerHTML = "<p>No join requests at the moment.</p>";
    }

  } catch (err) {
    console.error("Error loading requests:", err);
    requestsContainer.innerHTML = "<p>Failed to load join requests.</p>";
  }
}

// هاي بتحمل الأعضاء وبتعرضهم
async function loadMembers(userId, communityData) {
  try {
    const membersRef = collection(db, "communities", selectedCommunityId, "members");
    const membersSnap = await getDocs(membersRef);

    let hasMembers = false;
    const isLeader = userId === communityData.createdBy;

    membersSnap.forEach((memberDoc) => {
      hasMembers = true;
      renderMember(memberDoc, selectedCommunityId, isLeader);
    });

    if (!hasMembers) {
      membersContainer.innerHTML = "<p>No members found.</p>";
    }

  } catch (err) {
    console.error("Error loading members:", err);
    membersContainer.innerHTML = "<p>Failed to load members.</p>";
  }
}

// هون بنتأكد إذا المستخدم مسجّل دخول وبنحمّل كل البيانات
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await ensureUserDocument(user);
    const communityData = await loadCommunityData();
    if (communityData) {
      await loadJoinRequests(user.uid, communityData);
      await loadMembers(user.uid, communityData);
    }
  } else {
    alert("Please log in to manage the community.");
    window.location.href = "login.html";
  }
});
