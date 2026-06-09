document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');

  errorDiv.classList.add('d-none');
  successDiv.classList.add('d-none');

  if (newPassword !== confirmPassword) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.classList.remove('d-none');
    return;
  }

  if (newPassword.length < 8) {
    errorDiv.textContent = 'Password must be at least 8 characters';
    errorDiv.classList.remove('d-none');
    return;
  }

  try {
    const response = await API.auth.changePassword(currentPassword, newPassword);

    if (response.success) {
      successDiv.classList.remove('d-none');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 2000);
    }
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await API.auth.logout();
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = '/login.html';
  }
});
