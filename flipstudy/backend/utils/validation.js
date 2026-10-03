/* Server-side validation. Mirrors the frontend rules, since the server must never trust the client. */
const USERNAME_MIN = 4, USERNAME_MAX = 20;
const PASSWORD_MIN = 8, PASSWORD_MAX = 32;
const SPECIAL_CHARS = '!@#$%^&*_\\-+';
const RESERVED = ['__proto__', 'constructor', 'prototype', 'hasownproperty', 'tostring', 'valueof'];

function validateUsername(username){
  username = username || '';
  if (username.length < USERNAME_MIN) return { valid:false, message:`Username must be at least ${USERNAME_MIN} characters` };
  if (username.length > USERNAME_MAX) return { valid:false, message:`Username cannot exceed ${USERNAME_MAX} characters` };
  if (!/^[A-Za-z0-9_]+$/.test(username)) return { valid:false, message:'Only letters, numbers, and underscores allowed' };
  if (RESERVED.includes(username.toLowerCase())) return { valid:false, message:'That username is not available' };
  return { valid:true, message:'' };
}

function validateEmail(email){
  email = (email || '').trim();
  if (!email) return { valid:false, message:'Please enter your email address' };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { valid:false, message:'Please enter a valid email address' };
  return { valid:true, message:'' };
}

function passwordRuleChecklist(password){
  password = password || '';
  return [
    { label:`At least ${PASSWORD_MIN} characters (max ${PASSWORD_MAX})`, met: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { label:'Include uppercase letter', met: /[A-Z]/.test(password) },
    { label:'Include lowercase letter', met: /[a-z]/.test(password) },
    { label:'Include number', met: /[0-9]/.test(password) },
    { label:'Include special character', met: new RegExp(`[${SPECIAL_CHARS}]`).test(password) }
  ];
}
function validatePassword(password){
  const failed = passwordRuleChecklist(password).find(r => !r.met);
  return { valid: !failed, message: failed ? failed.label : '' };
}

module.exports = { validateUsername, validateEmail, validatePassword };
