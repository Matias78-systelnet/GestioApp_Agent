export const PASSWORD_COMPLEXITY_MESSAGE = 'La contraseña debe incluir caracteres de al menos 3 de estos 4 grupos: mayúsculas, minúsculas, números y símbolos.';

const CHARACTER_GROUPS = [/\p{Lu}/u, /\p{Ll}/u, /\p{N}/u, /[^\p{L}\p{N}]/u];

export function hasPasswordComplexity(password) {
  return CHARACTER_GROUPS.filter((pattern) => pattern.test(password)).length >= 3;
}

export function containsAccountOrName(password, username, fullName) {
  const normalizedPassword = password.toLocaleLowerCase();
  const accountName = String(username ?? '').toLocaleLowerCase();
  const nameParts = String(fullName ?? '').toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u);
  const accountParts = accountName.split(/[^\p{L}\p{N}]+/u);
  const blockedParts = [accountName, ...accountParts, ...nameParts].filter((part) => part.length >= 3);
  return blockedParts.some((part) => normalizedPassword.includes(part));
}