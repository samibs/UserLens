import React from 'react';

/**
 * Main navigation component
 */
const Navigation = ({ user, onLogout }) => {
  return (
    <nav className="main-navigation">
      <div className="logo">
        <a href="/">AppName</a>
      </div>
      
      <ul className="nav-links">
        <li><a href="/">Home</a></li>
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="/products">Products</a></li>
        <li><a href="/about">About</a></li>
      </ul>
      
      <div className="user-menu">
        {user ? (
          <>
            <span className="username">Hello, {user.name}</span>
            <div className="dropdown">
              <button className="dropdown-toggle">
                My Account
              </button>
              <div className="dropdown-menu">
                <a href="/profile">Profile</a>
                <a href="/settings">Settings</a>
                <button onClick={onLogout}>Logout</button>
              </div>
            </div>
          </>
        ) : (
          <div className="auth-links">
            <a href="/login" className="login-link">Sign In</a>
            <a href="/register" className="register-link">Create Account</a>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation; 