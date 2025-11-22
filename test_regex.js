// Test the regex replacement locally
const testText = "patients.  Rep Approach: • Test";

console.log("BEFORE:", JSON.stringify(testText));

const result = testText.replace(/(\.)\s+(Rep Approach:)/g, '$1\n\n$2');

console.log("AFTER:", JSON.stringify(result));
console.log("Has newline:", result.includes('\n'));
console.log("Newline count:", (result.match(/\n/g) || []).length);
