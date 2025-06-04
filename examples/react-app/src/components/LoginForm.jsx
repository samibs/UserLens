import React, { useState } from 'react';

/**
 * Login form component for user authentication
 */
const LoginForm = ({ onLogin, redirectUrl, showRegisterLink }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    
    // Call the login function passed as prop
    onLogin({ username, password })
      .then(() => {
        // Redirect on success
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      })
      .catch(err => {
        setError(err.message || 'Login failed. Please try again.');
      });
  };

  return (
    <div className="login-form-container">
      <h2>Sign In</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="Enter your username"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Enter your password"
            required
          />
        </div>
        
        <button type="submit" className="login-button">
          Sign In
        </button>
      </form>
      
      {showRegisterLink && (
        <div className="register-link">
          <p>Don't have an account? <a href="/register">Create one now</a></p>
        </div>
      )}
    </div>
  );
};

export default LoginForm; 