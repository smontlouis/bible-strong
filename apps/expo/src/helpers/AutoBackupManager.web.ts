export type BackupTrigger =
  | 'auto'
  | 'logout'
  | 'sync_error'
  | 'manual'
  | 'pre_migration'
  | 'account_entry'

export interface BackupInfo {
  filename: string
  filepath: string
  timestamp: number
  size: number
  modificationTime: number
}

class WebAutoBackupManager {
  async initialize(): Promise<void> {}
  scheduleBackup(_state: unknown): void {}
  async createBackupNow(_state: unknown, _trigger: BackupTrigger): Promise<boolean> {
    return true
  }
  async listBackups(): Promise<BackupInfo[]> {
    return []
  }
  async restoreBackup(_filename: string): Promise<never> {
    throw new Error('WEB_ONLINE_ONLY')
  }
  async clearAllBackups(): Promise<void> {}
  getLastAutoBackupTime(): number {
    return 0
  }
}

export const autoBackupManager = new WebAutoBackupManager()
