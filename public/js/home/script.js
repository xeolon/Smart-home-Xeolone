let currentUserPid = null;

fetch("/api/auth/me")
  .then(response => {
    if (response.ok) return response.json();
    throw new Error("Chưa đăng nhập");
  })
  .then(user => {
    currentUserPid = user.pid;
  })
  .catch(error => {
    console.error("Lỗi lấy thông tin người dùng:", error);
  });

document.addEventListener("DOMContentLoaded", () => {
  // Load bài viết trang đầu tiên
  loadPosts();

  // Lắng nghe sự kiện cuộn trên container chính
  const contentContainer = document.querySelector('.content-container');
  contentContainer.addEventListener('scroll', () => {
    // Debug log: kiểm tra các giá trị cuộn
    console.log("ScrollTop:", contentContainer.scrollTop,
                "ClientHeight:", contentContainer.clientHeight,
                "ScrollHeight:", contentContainer.scrollHeight);
    // Nếu đã cuộn gần đến cuối container (50px còn lại)
    if (contentContainer.scrollTop + contentContainer.clientHeight >= contentContainer.scrollHeight - 50) {
      loadMorePosts();
    }
  });
});

let currentPage = 1;
let isLoadingMorePosts = false;

// Hàm escape HTML để ngăn chặn chèn mã độc
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Hàm chuyển đổi URL thành link có thể nhấp
function autoLink(text) {
  const urlPattern = /(\b(https?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]))/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

async function loadPosts() {
  try {
    const response = await fetch(`/api/auth/posts?page=${currentPage}`);
    const posts = await response.json();
    const container = document.getElementById('posts-container');

    container.innerHTML = posts.map(post => generatePostHTML(post)).join('');
    posts.forEach(post => {
      loadComments(post.pid);
    });
  } catch (error) {
    console.error("Lỗi khi tải bài viết:", error);
    document.getElementById('posts-container').innerHTML = "<p>Lỗi khi tải bài viết!</p>";
  }
}

async function loadMorePosts() {
  if (isLoadingMorePosts) return;
  isLoadingMorePosts = true;
  currentPage++;
  const container = document.getElementById('posts-container');
  try {
    const response = await fetch(`/api/auth/posts?page=${currentPage}`);
    if (response.ok) {
      const posts = await response.json();
      if (posts.length > 0) {
        const newPostsHTML = posts.map(post => generatePostHTML(post)).join('');
        container.insertAdjacentHTML('beforeend', newPostsHTML);
        posts.forEach(post => {
          loadComments(post.pid);
        });
      } else {
        console.log("Không còn bài viết cũ hơn.");
      }
    }
  } catch (error) {
    console.error("Lỗi load thêm bài viết:", error);
  } finally {
    isLoadingMorePosts = false;
  }
}

function generatePostHTML(post) {
  let actionButtonsHTML = '';
  if (currentUserPid === post.user_pid) {
    actionButtonsHTML = `
      <li><a class="dropdown-item" href="#" onclick="editPost('${post.pid}')">Chỉnh sửa</a></li>
      <li><a class="dropdown-item" href="#" onclick="deletePost('${post.pid}')">Xoá</a></li>
      <li><a class="dropdown-item" href="#" onclick="sharePost('${post.pid}')">Chia sẻ</a></li>
    `;
  } else {
    actionButtonsHTML = `
      <li><a class="dropdown-item" href="#" onclick="sharePost('${post.pid}')">Chia sẻ</a></li>
    `;
  }

  return `
    <div class="card mb-3" id="post-${post.pid}">
      <div class="card-body">
        <div class="d-flex align-items-center mb-3">
          <a href="/profile?pid=${post.user_pid}" class="text-decoration-none">
            <img src="${post.avatar || '/static/default-avatar.png'}" class="rounded-circle me-2" width="40" height="40" alt="Avatar">
          </a>
          <a href="/profile?pid=${post.user_pid}" class="text-decoration-none text-dark">
            <h5 class="card-title mb-0">${escapeHTML(post.username)}</h5>
          </a>
          <div class="dropdown ms-auto">
            <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" id="dropdownMenuButton-${post.pid}" data-bs-toggle="dropdown" aria-expanded="false">
              ...
            </button>
            <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton-${post.pid}">
              ${actionButtonsHTML}
            </ul>
          </div>
        </div>
        <p class="card-text">${escapeHTML(post.content)}</p>
        ${post.image ? `<img src="${post.image}" class="img-fluid mb-3" alt="Post Image">` : ''}
        <button onclick="likePost('${post.pid}')" class="btn btn-danger btn-sm">❤️ ${post.likes}</button>
        <div class="card-footer bg-transparent">
          <div class="input-group mt-3">
            <input type="text" class="form-control comment-input" placeholder="Viết bình luận..." data-post-pid="${post.pid}">
            <button class="btn btn-outline-primary" onclick="postComment('${post.pid}')">Gửi</button>
          </div>
          <div id="comments-${post.pid}" class="comments-container mt-2"></div>
        </div>
      </div>
    </div>
  `;
}

function editPost(postPid) {
  alert("Chức năng chỉnh sửa cho bài viết " + postPid + " chưa được triển khai.");
}

function sharePost(postPid) {
  alert("Chức năng chia sẻ cho bài viết " + postPid + " chưa được triển khai.");
}

function deletePost(postPid) {
  if (confirm("Bạn có chắc chắn muốn xoá bài viết này không?")) {
    fetch(`/api/auth/posts/${postPid}`, { method: "DELETE" })
      .then(response => {
        if (response.ok) {
          document.getElementById("post-" + postPid).remove();
          alert("Bài viết đã được xoá.");
        } else {
          alert("Lỗi khi xoá bài viết.");
        }
      })
      .catch(error => {
        console.error("Lỗi:", error);
        alert("Lỗi khi kết nối đến server!");
      });
  }
}

async function createPost() {
  const content = document.getElementById('post-content').value;
  const image = document.getElementById('post-image').files[0];
  const formData = new FormData();

  if (!content) {
    alert("Vui lòng nhập nội dung bài viết!");
    return;
  }

  formData.append('content', content);
  if (image) formData.append('image', image);

  try {
    const response = await fetch('/api/auth/posts', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      alert("Đăng bài thành công!");
      currentPage = 1;
      loadPosts();
      document.getElementById('post-content').value = '';
      document.getElementById('post-image').value = '';
    } else {
      const result = await response.json();
      alert(result.message || "Lỗi khi đăng bài!");
    }
  } catch (error) {
    console.error("Lỗi:", error);
    alert("Lỗi khi kết nối đến server!");
  }
}

async function likePost(postPid) {
  try {
    const response = await fetch(`/api/auth/posts/${postPid}/like`, { method: 'PUT' });
    if (response.ok) {
      loadPosts();
    } else {
      alert("Lỗi khi thả tim!");
    }
  } catch (error) {
    console.error("Lỗi:", error);
    alert("Lỗi khi kết nối đến server!");
  }
}

async function postComment(postPid) {
  const input = document.querySelector(`.comment-input[data-post-pid="${postPid}"]`);
  const content = input.value.trim();

  if (!content) {
    alert("Vui lòng nhập nội dung bình luận!");
    return;
  }

  try {
    const response = await fetch('/api/auth/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_pid: postPid, content: content })
    });

    if (response.ok) {
      input.value = '';
      loadComments(postPid);
    } else {
      alert("Lỗi khi gửi bình luận!");
    }
  } catch (error) {
    console.error("Lỗi:", error);
    alert("Lỗi kết nối server!");
  }
}

async function loadComments(postPid, limit = 2) {
  try {
    const response = await fetch(`/api/auth/comments/${postPid}`);
    const comments = await response.json();
    const container = document.getElementById(`comments-${postPid}`);

    let commentsToShow = comments;
    let showButton = false;
    if (comments.length > limit) {
      commentsToShow = comments.slice(0, limit);
      showButton = true;
    }

    container.innerHTML = commentsToShow.map(comment => `
      <div class="comment-item">
        <a href="/profile?pid=${comment.user_pid}">
          <img src="${comment.avatar || '/static/default-avatar.png'}" class="comment-avatar" alt="Avatar">
        </a>
        <div class="comment-content">
          <a href="/profile?pid=${comment.user_pid}" class="comment-username-link">
            <div class="comment-username">${escapeHTML(comment.username)}</div>
          </a>
          <div class="comment-text">${autoLink(escapeHTML(comment.content))}</div>
          <div class="comment-time">${new Date(comment.created_at).toLocaleString()}</div>
        </div>
      </div>
    `).join('');

    if (showButton) {
      container.insertAdjacentHTML('beforeend', `
        <button class="btn btn-link btn-sm" onclick="showAllComments('${postPid}')">
          Xem thêm bình luận
        </button>
      `);
    }
  } catch (error) {
    console.error("Lỗi tải bình luận:", error);
  }
}

async function showAllComments(postPid) {
  try {
    const response = await fetch(`/api/auth/comments/${postPid}`);
    const comments = await response.json();

    let modalContent = comments.map(comment => `
      <div class="comment-item">
        <a href="/profile?pid=${comment.user_pid}">
          <img src="${comment.avatar || '/static/default-avatar.png'}" class="comment-avatar" alt="Avatar">
        </a>
        <div class="comment-content">
          <a href="/profile?pid=${comment.user_pid}" class="comment-username-link">
            <div class="comment-username">${escapeHTML(comment.username)}</div>
          </a>
          <div class="comment-text">${autoLink(escapeHTML(comment.content))}</div>
          <div class="comment-time">${new Date(comment.created_at).toLocaleString()}</div>
        </div>
      </div>
    `).join('');

    document.getElementById("commentsModalBody").innerHTML = modalContent;
    const modalElement = document.getElementById("commentsModal");
    const commentsModal = new bootstrap.Modal(modalElement);
    commentsModal.show();
  } catch (error) {
    console.error("Lỗi tải bình luận:", error);
  }
}

function logout() {
  fetch("/api/auth/logout", { method: "POST" })
    .then(() => {
      window.location.href = "/login";
    });
}

async function goToProfile() {
  try {
    const response = await fetch("/api/auth/me");
    if (response.ok) {
      const user = await response.json();
      window.location.href = `/profile?pid=${user.pid}`;
    } else {
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Lỗi:", error);
    window.location.href = "/login";
  }
}

