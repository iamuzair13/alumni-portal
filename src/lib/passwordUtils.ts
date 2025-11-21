/**
 * Generates a random, short, and easy-to-remember password
 * Format: 3-4 letters (lowercase) + 3-4 numbers
 * Example: abc1234, xyz5678
 * Total length: 6-8 characters
 */
export function generateEasyPassword(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  
  // Generate 3-4 random letters
  const letterCount = Math.floor(Math.random() * 2) + 3; // 3 or 4
  let password = "";
  
  for (let i = 0; i < letterCount; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  // Generate 3-4 random numbers
  const numberCount = Math.floor(Math.random() * 2) + 3; // 3 or 4
  for (let i = 0; i < numberCount; i++) {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  // Optionally shuffle the characters for better randomness
  // But keep it simple - letters first, then numbers is easier to remember
  return password;
}

/**
 * Alternative: Generate a password with a simple pattern
 * Format: word + number (e.g., "pass1234")
 */
export function generateSimplePassword(): string {
  const words = ["pass", "user", "alumni", "uol", "grad"];
  const numbers = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  
  const randomWord = words[Math.floor(Math.random() * words.length)];
  return randomWord + numbers;
}

// Export the default generator (easy password)
export default generateEasyPassword;

