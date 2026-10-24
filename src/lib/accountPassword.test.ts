import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = {
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};
vi.mock('./supabaseClient', () => ({ supabase: { auth } }));

const { changeMyPassword, passwordChangeError } = await import('./accountPassword');

describe('passwordChangeError', () => {
  it.each([
    [{ current: '', next: 'newpass123', confirm: 'newpass123' }, /current password/],
    [{ current: 'oldpass123', next: 'short', confirm: 'short' }, /at least 8/],
    [{ current: 'samepass123', next: 'samepass123', confirm: 'samepass123' }, /different/],
    [{ current: 'oldpass123', next: 'newpass123', confirm: 'newpass124' }, /do not match/],
  ])('rejects %o', (input, message) => {
    expect(passwordChangeError(input)).toMatch(message);
  });

  it('accepts a valid change', () => {
    expect(passwordChangeError({ current: 'oldpass123', next: 'newpass123', confirm: 'newpass123' })).toBeNull();
  });
});

describe('changeMyPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it('checks the current password, sets the new one and signs out other devices', async () => {
    await changeMyPassword('u@x.com', { current: 'oldpass123', next: 'newpass123' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'u@x.com', password: 'oldpass123' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('keeps other devices signed in when asked', async () => {
    await changeMyPassword('u@x.com', { current: 'oldpass123', next: 'newpass123' }, { signOutOtherDevices: false });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('does not change anything when the current password is wrong', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    await expect(changeMyPassword('u@x.com', { current: 'wrong', next: 'newpass123' })).rejects.toThrow(
      'Your current password is not correct',
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
