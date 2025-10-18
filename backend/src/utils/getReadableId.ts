export default function getReadableId() {
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // Crockford-style
  const base = ALPHABET.length;

  const timestamp = Math.floor(Date.now() / 1000); // seconds
  const random = Math.floor(Math.random() * base * base); // 2 chars of entropy

  const number = (timestamp % base ** 4) * base * base + random; // fit into 6 chars
  let id = "";
  let n = number;

  for (let i = 0; i < 6; i++) {
    id = ALPHABET[n % base] + id;
    n = Math.floor(n / base);
  }

  return id;
}

// console.log(getReadableId()); // e.g., 'K7X4Z3'
