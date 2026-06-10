/**
 * Generates a random, short, and easy-to-remember password
 * Format: 3-4 letters (lowercase) + 3-4 numbers
 * Example: abc1234, xyz5678
 */
export function generateEasyPassword(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";

  const letterCount = Math.floor(Math.random() * 2) + 3;
  let password = "";

  for (let i = 0; i < letterCount; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  const numberCount = Math.floor(Math.random() * 2) + 3;
  for (let i = 0; i < numberCount; i++) {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return password;
}

export function generateSimplePassword(): string {
  const words = ["pass", "user", "alumni", "uol", "grad"];
  const numbers = Math.floor(1000 + Math.random() * 9000);

  const randomWord = words[Math.floor(Math.random() * words.length)];
  return randomWord + numbers;
}

/** Strong random password for staff/admin password resets */
export function generatePassword(): string {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  password += "0123456789"[Math.floor(Math.random() * 10)];
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)];

  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  return password.split("").sort(() => Math.random() - 0.5).join("");
}

export default generateEasyPassword;
