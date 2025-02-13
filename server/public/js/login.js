document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      const data = await response.json();
      const token = data.token;
      const userId = data.user._id;
      console.log(data.user)
      localStorage.setItem('token', token);
      localStorage.setItem('userId', userId);
      window.location.href = '/index.html'; // Redirect to main page
    } else {
      alert('Login failed');
    }
  });
  