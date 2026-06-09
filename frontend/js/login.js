document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('error');

  errorDiv.classList.add('d-none');

  try {
    const response = await API.auth.login(username, password);

    if (response.success) {
      if (response.forceChange) {
        window.location.href = '/change-password.html';
      } else {
        window.location.href = '/dashboard.html';
      }
    }
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
});
