let resetModal;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  resetModal = new bootstrap.Modal(document.getElementById('resetModal'));
  currentUser = await API.auth.me();
  await loadUsers();

  const saved = localStorage.getItem('repairfund-theme') || 'dracula';
  document.getElementById('themeSelect').value = saved;
});

async function loadUsers() {
  try {
    const users = await API.users.getAll();
    const table = document.getElementById('usersTable');

    if (users.length === 0) {
      table.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No users</td></tr>';
      return;
    }

    const currentUserId = currentUser && currentUser.id;

    table.innerHTML = users.map(user => {
      const isSelf = user.id === currentUserId;
      const toggleLabel = user.role === 'admin' ? 'Demote to User' : 'Promote to Admin';
      return `
      <tr>
        <td>${user.username}</td>
        <td><span class="badge" style="background-color: ${user.role === 'admin' ? '#ff79c6' : '#8be9fd'}">${user.role}</span></td>
        <td>${user.force_password_change ? '<span class="badge bg-warning">Password Change Required</span>' : '<span class="badge bg-success">Active</span>'}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="resetPassword(${user.id})">Reset Password</button>
          ${!isSelf ? `<button class="btn btn-sm btn-info" onclick="toggleRole(${user.id})">${toggleLabel}</button>` : ''}
          ${!isSelf && user.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Delete</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Load users error:', err);
    document.getElementById('usersTable').innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading users</td></tr>';
  }
}

async function resetPassword(userId) {
  try {
    const response = await API.users.resetPassword(userId);
    document.getElementById('tempPasswordInput').value = response.tempPassword;
    resetModal.show();
  } catch (err) {
    alert('Error resetting password: ' + err.message);
  }
}

async function toggleRole(userId) {
  if (!confirm('Change this user\'s role?')) {
    return;
  }

  try {
    await API.users.toggleRole(userId);
    await loadUsers();
  } catch (err) {
    alert('Error changing role: ' + err.message);
  }
}

async function deleteUser(userId) {
  if (!confirm('Delete this user and all their contributions? This cannot be undone.')) {
    return;
  }

  try {
    await API.users.delete(userId);
    await loadUsers();
  } catch (err) {
    alert('Error deleting user: ' + err.message);
  }
}

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('newUsername').value;
  const password = document.getElementById('newPassword').value;
  const errorDiv = document.getElementById('addError');
  const successDiv = document.getElementById('addSuccess');

  errorDiv.classList.add('d-none');
  successDiv.classList.add('d-none');

  if (password.length < 8) {
    errorDiv.textContent = 'Password must be at least 8 characters';
    errorDiv.classList.remove('d-none');
    return;
  }

  try {
    await API.users.create(username, password);
    successDiv.classList.remove('d-none');

    // Reset form
    document.getElementById('addUserForm').reset();

    // Reload users
    await loadUsers();

    // Hide success message
    setTimeout(() => {
      successDiv.classList.add('d-none');
    }, 3000);
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const input = document.getElementById('tempPasswordInput');
  input.select();
  document.execCommand('copy');
  document.getElementById('copyBtn').textContent = 'Copied!';
  setTimeout(() => {
    document.getElementById('copyBtn').textContent = 'Copy';
  }, 2000);
});

document.getElementById('refreshBtn').addEventListener('click', loadUsers);

document.getElementById('applyThemeBtn').addEventListener('click', () => {
  const theme = document.getElementById('themeSelect').value;
  localStorage.setItem('repairfund-theme', theme);
  document.getElementById('theme-stylesheet').href = '/css/' + theme + '.css';
  const success = document.getElementById('themeSuccess');
  success.classList.remove('d-none');
  setTimeout(() => success.classList.add('d-none'), 2500);
});

async function downloadBackup() {
  const errorDiv = document.getElementById('backupError');
  const successDiv = document.getElementById('backupSuccess');
  errorDiv.classList.add('d-none');
  successDiv.classList.add('d-none');

  try {
    await API.backup.download();
    successDiv.classList.remove('d-none');
    setTimeout(() => successDiv.classList.add('d-none'), 3000);
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
}

async function restoreBackup() {
  const fileInput = document.getElementById('restoreFileInput');
  const errorDiv = document.getElementById('restoreError');
  const successDiv = document.getElementById('restoreSuccess');
  errorDiv.classList.add('d-none');
  successDiv.classList.add('d-none');

  if (!fileInput.files || fileInput.files.length === 0) {
    errorDiv.textContent = 'Please select a backup file first.';
    errorDiv.classList.remove('d-none');
    return;
  }

  if (!confirm('This will permanently replace all current data with the contents of the backup file. Are you sure?')) {
    return;
  }

  const file = fileInput.files[0];
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    errorDiv.textContent = 'Invalid file: could not parse JSON.';
    errorDiv.classList.remove('d-none');
    return;
  }

  try {
    const result = await API.backup.restore(data);
    successDiv.textContent = `Restore complete — ${result.usersRestored} users and ${result.entriesRestored} entries restored.`;
    successDiv.classList.remove('d-none');
    fileInput.value = '';
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
}

document.getElementById('downloadBackupBtn').addEventListener('click', downloadBackup);
document.getElementById('restoreBackupBtn').addEventListener('click', restoreBackup);

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await API.auth.logout();
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = '/login.html';
  }
});
