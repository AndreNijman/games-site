// The owner's account. The admin page can't ban or rename it, or ban a device
// it has signed in on, and no ban ever blocks it: a ban already in the table
// (or one written straight into D1) is ignored for the account and for every
// browser that has signed in to it. Usernames are unique regardless of case.

const PROTECTED_ACCOUNTS = new Set(["andrenijman"]);

export function isProtectedAccount(username) {
  return PROTECTED_ACCOUNTS.has(String(username || "").trim().toLowerCase());
}

/** Whether the account with this id is protected. */
export async function isProtectedAccountId(db, accountId) {
  if (!accountId) return false;
  const row = await db.prepare("SELECT username FROM accounts WHERE id = ?").bind(accountId).first();
  return isProtectedAccount(row?.username);
}

/** Whether this visit belongs to the owner: signed in as them, or on a browser that has been. */
export async function isProtectedVisit(db, account, device) {
  if (isProtectedAccount(account?.username)) return true;
  return isProtectedAccountId(db, device?.account_id);
}

/** Whether the device with this id has signed in to a protected account. */
export async function isProtectedDevice(db, deviceId) {
  if (!deviceId) return false;
  const row = await db.prepare(
    "SELECT accounts.username FROM devices JOIN accounts ON accounts.id = devices.account_id WHERE devices.id = ?"
  ).bind(deviceId).first();
  return isProtectedAccount(row?.username);
}
