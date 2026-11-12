const USER_NAME_KEY = 'ftth_qc_display_name';

export function getStoredUserName(): string {
  const name = localStorage.getItem(USER_NAME_KEY);
  return name ? name.trim() : '';
}

export function setStoredUserName(name: string): void {
  localStorage.setItem(USER_NAME_KEY, name.trim());
}

export function promptForUserNameIfNeeded(): string {
  let name = getStoredUserName();
  if (!name) {
    const input = window.prompt('Masukkan Nama Panggilan Anda (untuk kolaborasi tim di lapangan):', 'Teknisi Lapangan');
    name = (input && input.trim()) ? input.trim() : `Teknisi_${Math.random().toString(36).substring(2, 6)}`;
    setStoredUserName(name);
  }
  return name;
}
